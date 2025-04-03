import { Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";

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

interface Product {
  title: string;
  url: string;
}

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

    for (let i = 0; i < 5; i++) {
      const url = `https://www.amazon.com/s?k=${encodeURIComponent(
        product
      )}&page=${i + 1}`;
      console.log("Fetching URL:", url);

      const html = await fetchFromUrl(url);
      const $ = cheerio.load(html);

      $('[cel_widget_id^="MAIN-SEARCH_RESULTS-"]').each((_, container) => {
        const $container = $(container);

        $container.find(".s-line-clamp-2").each((_, el) => {
          const $el = $(el);
          const $anchor = $el.closest("a");
          const href = $anchor.attr("href") || "";
          const title = $el.text().trim();
          const fullUrl = href.startsWith("http")
            ? href
            : `https://www.amazon.com${href}`;

          if (title && fullUrl) {
            products.push({ title, url: fullUrl });
          }
        });
      });
      console.log(`Page ${i + 1}: Found ${products.length} products so far.`);
    }

    res.status(200).json({
      count: products.length,
      products,
    });
  } catch (error: any) {
    console.error("Error fetching product:", error);
    res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};
