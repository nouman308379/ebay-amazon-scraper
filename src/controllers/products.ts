import { Request, Response } from "express";
import * as cheerio from "cheerio";
import { Product, DetailedProduct } from "../types/product.js";
import { filterProductsWithAI } from "../utils/productFilter.js";
import { request } from "../utils/request.js";

export const getProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let { query, maxPages } = req.body;

    let prompt =
      req.body.prompt ||
      'User searches for a product or accessory providing its name and we would like to select from the list of product names and links we found on Amazon the ones matching that searched product.\nUser have entered the product name or accessory: {{query}}\nWe have found the following products on amazon: {{products}}\n\nBased on product titles, I want you to filter the titles that best match the given product name. Prioritize complete products over accessories, unless the user query explicitly includes the word "accessory," "filter," "wand," "replacement," etc.\nPlease stop at max 10 matches\nSpecifically:\n1. Focus on Core Products: If the user\'s query doesn\'t mention accessories, return only the titles that clearly refer to the product itself, not its parts or compatible items.\n2. Accessory Handling: If the user\'s query does include "accessory," "filter," "wand," or "replacement" (or similar terms related to parts), then include titles that specifically refer to accessories compatible with the product.\n3. Fuzzy Matching: Be flexible with variations in the title, such as different word order, minor spelling variations, or the inclusion of model numbers (e.g., 3797V). The core product name should be the primary matching factor.\n4. Exclusion: Exclude results that are clearly for completely different vacuum cleaners or brands, even if they happen to share a few words with the target product.\nRETURN: list of product titles';

    console.log("Body:", req.body);
    if (!query) {
      res
        .status(400)
        .json({ message: "Product query and prompt are required" });
      return;
    }

    let products: Product[] = [];
    maxPages = Number(maxPages ?? "1");
    prompt = prompt.replace("{{query}}", query);

    // Create array of page numbers and fetch all pages in parallel
    const pagePromises = Array.from({ length: maxPages }, (_, i) => {
      const url = `https://www.amazon.com/s?k=${query.replaceAll(
        " ",
        "+"
      )}&page=${i + 1}`;
      console.log("Fetching URL:", url);

      return request({ url }, { zone: "residential_proxy" })
        .then(({ data }) => {
          if (!data) return [];

          const $ = cheerio.load(data);
          const pageProducts: Product[] = [];

          $('[cel_widget_id^="MAIN-SEARCH_RESULTS-"]').each((_, container) => {
            const $container = $(container);
            const title = $container
              .find(".s-line-clamp-2, .s-title-instructions-style")
              .first()
              .text()
              .trim();
            const $anchor = $container.find("a[href*='/dp/']").first();
            const href = $anchor.attr("href") || "";
            const fullUrl = href.startsWith("http")
              ? href
              : `https://www.amazon.com${href.split("?")[0]}`;

            if (title && fullUrl && !title.includes("Sponsored")) {
              pageProducts.push({ title, url: fullUrl });
            }
          });

          return pageProducts;
        })
        .catch((err) => {
          console.error(`Error fetching ${url}:`, err);
          return [];
        });
    });

    // Wait for all pages to be fetched and flatten the results
    const productArrays = await Promise.all(pagePromises);
    products = productArrays.flat();
    console.log(`Total products collected: ${products.length}`);

    if (products.length === 0) {
      res.status(200).json({
        message:
          "No products returned from amazon or there was an error fetching products",
      });
      return;
    }

    prompt = prompt.replace("{{products}}", JSON.stringify(products));
    const aiResult = await filterProductsWithAI(prompt);
    if (!aiResult) {
      res.status(200).json({ message: "No products after llm filtration" });
      return;
    }

    let filteredProducts: Product[] = [];
    try {
      filteredProducts = aiResult
        .map((title: string) => ({
          title,
          url: products.find((p) => p.title === title)?.url || "",
        }))
        .filter((p: Product) => p.title && p.url);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      filteredProducts = products;
    }

    console.log("Fetching details for", filteredProducts.length, "products");
    const detailedFilteredProducts: DetailedProduct[] = await Promise.all(
      filteredProducts.map(getProductDetails)
    );

    res.status(200).json({
      amazonSearchResults: products,
      products: detailedFilteredProducts,
    });
  } catch (error: any) {
    console.error(`Error ${error}`);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getProductDetails = async (
  product: Product
): Promise<DetailedProduct> => {
  try {
    const { data } = await request(
      { url: product.url },
      { zone: "residential_proxy" }
    );
    const $ = cheerio.load(data);

    // Extract price information
    const getPrice = (): string | null => {
      // Try the main price display first
      const priceDiv = $(".corePriceDisplay_desktop_feature_div, .a-price");

      const symbol = priceDiv.find(".a-price-symbol").first().text().trim();
      const whole = priceDiv
        .find(".a-price-whole")
        .first()
        .text()
        .trim()
        .replace(/,/g, ""); // Remove thousands separators
      const fraction = priceDiv.find(".a-price-fraction").first().text().trim();

      if (symbol && whole && fraction) {
        return `${symbol}${whole}${fraction}`;
      }

      return null;
    };

    const price = getPrice();
    // Extract feature bullets
    const featureBullets = $("#feature-bullets .a-list-item")
      .map((i, el) => $(el).text().trim())
      .get();

    // a-popover-content-1

    // Extract product overview details
    const productFeatures: Record<string, string> = {};
    $("#productOverview_feature_div tr").each((i, el) => {
      const key = $(el).find("td.a-span3").text().trim();
      const $valueTd = $(el).find("td.a-span9");
      const baseText = $valueTd.find(".a-size-base").text().trim();
      const offscreenText = $valueTd
        .find(".a-truncate-full.a-offscreen")
        .text()
        .trim();
      const value = offscreenText || baseText;

      if (key && value) {
        productFeatures[key] = value;
      }
    });

    // a-span9 a-size-base a-truncate-full a-offscreen

    const scriptContent = $("script")
      .map((_, el) => $(el).html())
      .get()
      .find((content) => content && content.includes("ImageBlockATF"));

    const largeImages = scriptContent ? extractLargeImages(scriptContent) : [];

    // Extract full product description as plain text
    const productDescription = $("#productDescription").text().trim();

    return {
      ...product,
      price: price || "Price not available",
      bulletPoints: featureBullets,
      features: productFeatures,
      imageUrls: largeImages ? largeImages : [],
      description: productDescription,
    };
  } catch (error) {
    console.error(`Failed to fetch details for ${product.title}:`, error);
    return product;
  }
};

function extractLargeImages(scriptContent: string) {
  try {
    const hiResImagePattern =
      /"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/g;
    const matches = [...scriptContent.matchAll(hiResImagePattern)];

    if (matches && matches.length > 0) {
      return matches.map((match) => match[1]);
    }

    const colorImagesMatch = scriptContent.match(
      /'colorImages':\s*{\s*'initial':\s*(\[[\s\S]*?\])}/
    );

    if (colorImagesMatch && colorImagesMatch[1]) {
      const imagesArrayString = colorImagesMatch[1]
        .replace(/'/g, '"')
        .replace(/([a-zA-Z0-9_]+):/g, '"$1":');

      try {
        const mockFunction = new Function("return " + imagesArrayString);
        const imagesArray = mockFunction();

        return imagesArray.map((item: { hiRes: any }) => item.hiRes);
      } catch (evalError) {
        console.error("Error evaluating images array:", evalError);
      }
    }

    const simpleUrlPattern =
      /large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/g;
    const simpleMatches = [...scriptContent.matchAll(simpleUrlPattern)];
    return simpleMatches.map((match) => match[1]);
  } catch (error) {
    console.error("Error extracting large images:", error);
    return [];
  }
}
