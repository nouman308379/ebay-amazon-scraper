import { Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { Product, DetailedProduct } from "../types/product";
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
    const maxPages = 1;

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
      const jsonString = (
        typeof aiResult === "string" ? aiResult : JSON.stringify(aiResult)
      )
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

    // Get details for all filtered products (with rate limiting)
    const detailedProducts: DetailedProduct[] = [];
    for (const product of filteredProducts) {
      try {
        const detailedProduct = await getProductDetails(product);
        detailedProducts.push(detailedProduct);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limiting
      } catch (error) {
        console.error(`Error processing ${product.title}:`, error);
        detailedProducts.push(product); // Add basic product info if details fail
      }
    }

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

const getProductDetails = async (
  product: Product
): Promise<DetailedProduct> => {
  try {
    const response = await fetchFromUrl(product.url);
    const $ = cheerio.load(response);

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
     const productDescription = $('#productDescription').text().trim();



    return {
      ...product,
      price: price || 'Price not available',
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
