import { Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const fetchFromUrl = async (url: string): Promise<string> => {
  try {
    // Set more realistic headers to avoid being blocked
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
  description?: any;
  url: string;
  asin: string;
  price: string;
  index: number;
  bulletPoints?: string[];
  features?: Record<string, string>;
  imageUrls?: string[];
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

    for (let i = 0; i < 1; i++) {
      const url = `https://www.amazon.com/s?k=${encodeURIComponent(
        product
      )}&page=${i + 1}`;
      console.log("Fetching URL:", url);

      const html = await fetchFromUrl(url);

      // Use cheerio instead of JSDOM
      const $ = cheerio.load(html);

      // Debug - output the HTML structure
      console.log("HTML snippet:", html.substring(0, 500) + "...");

      // Focus only on .s-line-clamp-2 elements
      const elements = $(".s-line-clamp-2");
      console.log(`Found ${elements.length} elements with .s-line-clamp-2`);

      // Extract information from the elements

      const products: Product[] = elements
        .map((i, el) => {
          const $el = $(el);

          // Find parent anchor tag if the element itself isn't an anchor
          const $anchor = $el.is("a") ? $el : $el.closest("a");
          const href = $anchor.attr("href") || "";
          const title = $el.text().trim();
          const fullUrl = href.startsWith("http")
            ? href
            : href
            ? `https://www.amazon.com${href}`
            : "";

          // Get the parent product element to extract additional data if needed
          const $productElement = $el.closest(".s-result-item");
          const asin = $productElement.attr("data-asin") || "";

          // Get the price if available
          const $priceElement = $productElement.find(".a-price .a-offscreen");
          const price =
            $priceElement.length > 0 ? $priceElement.first().text() : "";

          return {
            title,
            url: fullUrl,
            asin,
            price,
            index: i + 1,
          };
        })
        .get(); // Convert to regular array

      if (products.length === 0) {
        // If no products found, check if we're being blocked or if page structure changed
        if (html.includes("captcha") || html.includes("robot")) {
          console.log("Detected CAPTCHA or anti-bot measures");
          res.status(403).json({
            message:
              "Amazon is blocking the request. Try using a proxy or Puppeteer.",
          });
          return;
        }

        // Save HTML for debugging
        console.log("No products found. Page structure may have changed.");
      }

      if (products.length > 0) {
        const response = await fetchFromUrl(products[4].url);
        const $ = cheerio.load(response);

        // Extract feature bullets
        const featureBullets = $("#feature-bullets .a-list-item")
          .map((i, el) => $(el).text().trim())
          .get();

        // Extract product overview details (key-value pairs)
        const productFeatures: Record<string, string> = {};
        $("#productOverview_feature_div tr").each((i, el) => {
          const key = $(el).find("td").first().text().trim();
          const value = $(el).find("td").last().text().trim();
          if (key && value) {
            productFeatures[key] = value;
          }
        });

        // Extract image URLs from `.a-list-item .a-button-text img`
        const imageUrls: string[] = $(".a-list-item .a-button-text img")
          .map((i, el) => $(el).attr("src")?.trim() || "")
          .get();

        const productDescription: Record<string, string | string[]> = {};
        const descriptionParagraphs = $("#productDescription p");

        let lastHeading: string | null = null;

        descriptionParagraphs.each((i, el) => {
          const spans = $(el).find("span");

          if (spans.length === 2) {
            // Case 1: Two spans -> Key-Value pair
            const key = spans.first().text().trim();
            const value = spans.last().text().trim();
            if (key && value) {
              productDescription[key] = value;
            }
          } else if (spans.length === 1) {
            const span = spans.first();
            const text = span.text().trim();

            if (span.hasClass("a-text-bold")) {
              // Case 2: Single span with "a-text-bold" -> Heading
              lastHeading = text;
              productDescription[lastHeading] = [];
            } else if (lastHeading) {
              // Case 3: Single span without "a-text-bold" -> Append to last heading
              (productDescription[lastHeading] as string[]).push(text);
            }
          }
        });

        // Convert arrays with one element to string
        Object.keys(productDescription).forEach((key) => {
          if (
            Array.isArray(productDescription[key]) &&
            productDescription[key].length === 1
          ) {
            productDescription[key] = productDescription[key][0];
          }
        });

        products[4].bulletPoints = featureBullets;
        products[4].features = productFeatures;
        products[4].imageUrls = imageUrls;
        products[4].description = productDescription;
      }

      res.status(200).json({
        count: products.length,
        product: products[4],
      });
    }
  } catch (error: any) {
    console.error("Error fetching product:", error);
    res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};
