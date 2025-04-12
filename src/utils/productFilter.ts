import axios from "axios";
import { Product } from "../types/product.js";
import dotenv from "dotenv";
import { writeFileSync } from "fs";

dotenv.config();
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

interface FilteringRules {
  searchTerm: string;
  products: Product[];
}

export const generateFilteringPrompt = ({ searchTerm, products }: FilteringRules): string => {
  return `
    You are a product filtering assistant. Your task is to filter a list of product titles based on a search term, applying the following refined rules:

    1. BRAND MATCHING:
      - Match if the product title contains the full brand name from the search term
      - Partial matches (e.g., "Apple iPhone" → "Apple iPhone 13") are acceptable
      - Ignore misspellings and unrelated brands
      - Brand match is case-insensitive

    2. PRODUCT TYPE SPECIFICATION:
      - If the search term contains a product type (e.g., laptop, phone, shoes), include only products matching that type
      - Match plurals or variants (e.g., “phones” matches “phone”)
      - Case-insensitive and tolerant of synonyms (e.g., “mobile” for “phone”)

    3. MODEL/VERSION FILTERING:
      - If a model/version is included (e.g., "Air Max 90", "Galaxy S23"), filter strictly by that
      - Include minor variations (e.g., "Galaxy S23 Ultra" for "Galaxy S23") unless a more specific variant is named
      - Ignore accessories or bundles

    4. ACCESSORY EXCLUSION:
      - Exclude generic accessories (cases, chargers, cables, stands)
      - Exclude products labeled as "bundle", "combo", or similar unless they clearly match the exact model and product type
      - Exclude unrelated add-ons

    5. RULE OF STRICT INCLUSION:
      - If unsure whether a product matches → EXCLUDE it
      - Prefer fewer accurate matches over many vague ones
      - Include products with partial model names if no more precise options are found

    FORMAT:
    - Return ONLY an array of matching product titles (as strings)
    - No extra text, no explanations

    Search term: "${searchTerm}"

    Products to filter:
    ${JSON.stringify(products, null, 2)}
  `;
};

export const filterProductsWithAI = async (
  searchTerm: string,
  products: Product[]
): Promise<string[] | null> => {
  try {
    const prompt = generateFilteringPrompt({ searchTerm, products });

    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const filteredProductsText = response.data.candidates[0].content.parts[0].text;

    writeFileSync("filteredProducts.md", filteredProductsText);

    try {
      // Clean and parse the AI response
      const jsonString = filteredProductsText.replace(/^```.*\n|\n```$/g, "").trim();

      return JSON.parse(jsonString) as string[];
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return null;
    }
  } catch (error: any) {
    console.error("AI Filtering Error:", error.response?.data || error.message);
    return null;
  }
};
