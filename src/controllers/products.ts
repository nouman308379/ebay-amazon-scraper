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
    let { query, prompt, maxPages } = req.body;

    console.log("Body:", req.body);
    if (!query || !prompt) {
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
      const offscreenText = $valueTd.find(".a-truncate-full.a-offscreen").text().trim();
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
