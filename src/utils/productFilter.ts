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
  You are a product filtering assistant. Your task is to strictly filter products based on these rules:
  
  1. BRAND MATCHING:
     - Must contain the exact brand name from search term "${searchTerm}"
     - Ignore misspellings or similar-sounding brands
     - Brand matching is case-insensitive
  
  2. PRODUCT TYPE SPECIFICATION:
     - If the search term contains a product type (e.g., laptop, phone, shoes, jacket, chair, blender, etc.), only include that type
     - Product type matching is case-insensitive
     - Example: "${searchTerm}" with "laptop" → only laptops
  
  3. MODEL/VERSION FILTERING:
     - If a model, version, or specific variant is mentioned, only include exact matches
     - Example: "Nike Air Max 90" → Only Air Max 90
     - Example: "Samsung Galaxy S23" → Only S23
     - Example: "MacBook Air M2" → Only M2 Air
  
  4. ACCESSORY & NON-ESSENTIAL EXCLUSION:
     - Always exclude:
       * Generic accessories (cases, chargers, cables, etc.)
       * Bundles that contain accessories
       * Unrelated add-on products
  
  5. STRICTNESS RULES:
     - When uncertain → exclude
     - Partial matches → include
     - Older models → include unless specific version requested
     - Bundles containing accessories → exclude
  
  FORMAT REQUIREMENTS:
  - Return ONLY an array of product titles
  - No additional text or explanations
  
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
      const jsonString = filteredProductsText.replace(/^```json\n|\n```$/g, "").trim();

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
