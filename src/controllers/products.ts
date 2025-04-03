import { Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { Product } from "../types/product";
import { filterProductsWithAI } from "../utils/productFilter";

const fetchFromUrl = async (url: string): Promise<string> => {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
      },
      timeout: 30000, // Increase timeout
    });

    console.log("Response status:", response.status);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching data from URL:", error);
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
};


export const getProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const product = req.query.product as string;
    if (!product) {
      res.status(400).json({ message: "Product query parameter is required" });
      return;
    }

    const products: Product[] = [];
    const maxPages = 5;

    // Fetch products from Amazon
    for (let i = 0; i < maxPages; i++) {
      try {
        const url = `https://www.amazon.com/s?k=${encodeURIComponent(
          product
        )}&page=${i + 1}`;
        console.log("Fetching URL:", url);

        const html = await fetchFromUrl(url);
        const $ = cheerio.load(html);

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

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing page ${i + 1}:`, error);
      }
    }

    if (products.length === 0) {
      res.status(404).json({ message: "No products found" });
      return;
    }

    const aiResult = await filterProductsWithAI(product, products);
    

    let filteredProducts: Product[] = [];
    try {
      const jsonString = (typeof aiResult === "string" ? aiResult : JSON.stringify(aiResult))
        .replace(/^```json\n|\n```$/g, "")
        .trim();

      const parsedResponse = JSON.parse(jsonString);

      filteredProducts = Array.isArray(parsedResponse)
        ? parsedResponse
        : parsedResponse.products || parsedResponse.items || [];

      filteredProducts = filteredProducts
        .map((p: any) => ({
          title: p.title || "",
          url: p.url || "",
        }))
        .filter((p: Product) => p.title && p.url);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      filteredProducts = products;
    }

    res.status(200).json({
      count: filteredProducts.length,
      products: filteredProducts,
    });
  } catch (error: any) {
    console.error("Error in getProduct:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

