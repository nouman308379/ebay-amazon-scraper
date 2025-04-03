import { Request, Response } from "express";
import * as cheerio from "cheerio";
import { Product, DetailedProduct } from "../types/product.js";
import { filterProductsWithAI } from "../utils/productFilter.js";
import { request } from "../utils/request.js";
import { writeFileSync } from "fs";

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = req.query.product as string;
    if (!product) {
      res.status(400).json({ message: "Product query parameter is required" });
      return;
    }

    let products: Product[] = [];
    const maxPages = 1;

    // Fetch products from Amazon
    for (let i = 0; i < maxPages; i++) {
      try {
        const url = `https://www.amazon.com/s?k=${product.replaceAll(" ", "+")}&page=${i + 1}`;
        console.log("Fetching URL:", url);

        console.log("making tls request");

        const { data } = await request({ url }, { zone: "residential" });
        const $ = cheerio.load(data);

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

          if (title && fullUrl) {
            products.push({ title, url: fullUrl });
          }
        });

        console.log(`Page ${i + 1}: Found ${products.length} products so far.`);

        products = products.filter(
          (p) => !p.title.includes("Sponsor") && !p.title.includes("Sponsored")
        );
        writeFileSync("products.json", JSON.stringify(products, null, 2));

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing page ${i + 1}:`, error);
      }
    }

    if (products.length === 0) {
      res.status(200).json({ message: "No products found" });
      return;
    }

    const aiResult = await filterProductsWithAI(product, products);

    let filteredProducts: Product[] = [];
    try {
      const jsonString = (typeof aiResult === "string" ? aiResult : JSON.stringify(aiResult))
        .replace(/^```json\n|\n```$/g, "")
        .trim();

      const parsedResponse = JSON.parse(jsonString);

      if (!Array.isArray(parsedResponse)) {
        throw new Error("Invalid AI response");
      }

      filteredProducts = parsedResponse
        .map((title: string) => ({
          title,
          url: products.find((p) => p.title === title)?.url || "",
        }))
        .filter((p: Product) => p.title && p.url);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      filteredProducts = products;
    }

    // Get details for all filtered products (with rate limiting)
    console.log("Fetching details for", filteredProducts.length, "products");
    const detailedProducts: DetailedProduct[] = await Promise.all(
      filteredProducts.map(getProductDetails)
    );

    res.status(200).json({
      count: detailedProducts.length,
      products: detailedProducts,
    });
  } catch (error: any) {
    console.error("Error in getProduct:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getProductDetails = async (product: Product): Promise<DetailedProduct> => {
  try {
    const { data } = await request({ url: product.url }, { zone: "residential" });
    const $ = cheerio.load(data);

    // Extract price information
    const getPrice = (): string | null => {
      // Try the main price display first
      const priceDiv = $(".corePriceDisplay_desktop_feature_div, .a-price");

      const symbol = priceDiv.find(".a-price-symbol").first().text().trim();
      const whole = priceDiv.find(".a-price-whole").first().text().trim().replace(/,/g, ""); // Remove thousands separators
      const fraction = priceDiv.find(".a-price-fraction").first().text().trim();

      if (symbol && whole && fraction) {
        return `${symbol}${whole}.${fraction}`;
      }

      return null;
    };

    const price = getPrice();
    // Extract feature bullets
    const featureBullets = $("#feature-bullets .a-list-item")
      .map((i, el) => $(el).text().trim())
      .get();

    // Extract product overview details
    const productFeatures: Record<string, string> = {};
    $("#productOverview_feature_div tr").each((i, el) => {
      const key = $(el).find("td").first().text().trim();
      const value = $(el).find("td").last().text().trim();
      if (key && value) {
        productFeatures[key] = value;
      }
    });

    // Extract image URLs
    const imageUrls: string[] = $(".a-list-item .a-button-text img")
      .map((i, el) => $(el).attr("src")?.trim() || "")
      .get();

    // Extract full product description as plain text
    const productDescription = $("#productDescription").text().trim();

    return {
      ...product,
      price: price || "Price not available",
      bulletPoints: featureBullets,
      features: productFeatures,
      imageUrls: imageUrls,
      description: productDescription,
    };
  } catch (error) {
    console.error(`Failed to fetch details for ${product.title}:`, error);
    return product; // Return basic product info if details fail
  }
};
