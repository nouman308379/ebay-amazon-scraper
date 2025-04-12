import { Product } from "../types/product.js";
import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

interface FilteringRules {
  searchTerm: string;
  products: Product[];
}

export const generateFilteringPrompt = ({ searchTerm, products }: FilteringRules): string => {
  return `
  we have a website where we show the images of the product a user have searched for. User have search for following product:
  ${searchTerm}

  and have found the following products for search resutls:
  ${JSON.stringify(products, null, 2)}

  I want you to find the individual product user have search for.
  RETURN: list of product titles
  `;
};

export const filterProductsWithAI = async (
  searchTerm: string,
  products: Product[]
): Promise<string[] | null> => {
  try {
    const prompt = generateFilteringPrompt({ searchTerm, products });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const filteredProductsText = response.text;
    console.log(response.text);
    if (!filteredProductsText) {
      throw new Error("No response from AI");
    }

    return JSON.parse(filteredProductsText) as string[];
  } catch (error: any) {
    console.error("AI Filtering Error:", error.response?.data || error.message);
    return null;
  }
};

if (import.meta.url.endsWith(process.argv[1])) {
  const products = [
    {
      title:
        "BissellCleanView Swivel Rewind Pet Reach Vacuum Cleaner, with Quick Release Wand, Swivel Steering and Automatic Cord Rewind, 3197A (Color May Vary)",
      url: "https://www.amazon.com/BISSELL-CleanView-Swivel-Rewind-Cleaner/dp/B09LPCZ9FF/ref=sr_1_1",
    },
    {
      title:
        "Bissell2254 CleanView Swivel Rewind Pet Upright Bagless Vacuum, Automatic Cord Rewind, Swivel Steering, Powerful Pet Hair Pickup, Specialized Pet Tools, Large Capacity Dirt Tank, Teal",
      url: "https://www.amazon.com/2254-CleanView-Automatic-Steering-Specialized/dp/B07F6MXJ9X/ref=sr_1_2",
    },
    {
      title:
        "BissellSurfaceSense Allergen Lift-Off Pet Upright Vacuum, with Tangle-Free Multi-Surface Brush Roll, LED Headlights, & Lift-Off Technology",
      url: "https://www.amazon.com/SurfaceSense-Tangle-Free-Multi-Surface-Headlights-Technology/dp/B0BPJX6Z19/ref=sr_1_3",
    },
    {
      title:
        "Bissell24613 Pet Hair Eraser Turbo Plus Lightweight Vacuum, Tangle-Free Brush Roll, Powerful Pet Hair Pick-up, SmartSeal Allergen System, Specialized Pet Tools, Easy Empty Dirt Tank",
      url: "https://www.amazon.com/BISSELL-Lightweight-Upright-Cleaner-24613/dp/B07QXTS4KH/ref=sr_1_4",
    },
    {
      title:
        "KEEPOWReplacement Parts Compatible with Bissell Cleanview Swivel Pet Vacuum 2252 2254 2486 2489 22543 24899 1327 1333, 1 Brush Roll Replacement and 3 Vacuum Belt 3031120 with 1 Cleaning Tool",
      url: "https://www.amazon.com/KEEPOW-Replacement-Compatible-Cleanview-Cleaning/dp/B0DQD3NJYH/ref=sr_1_5",
    },
    {
      title:
        "KEEPOWReplacement Parts Compatible with Bissell Cleanview Swivel Pet Vacuum 2252 2254 2486 2489 22543 24899 1327 1333, 1 Brush Roll Replacement and 5 Vacuum Belt 3031120 with 1 Cleaning Tool",
      url: "https://www.amazon.com/KEEPOW-Replacement-Compatible-Cleanview-Cleaning/dp/B0D9JT3S8D/ref=sr_1_6",
    },
    {
      title: "Bissell3624 Spot Clean Professional Portable Carpet Cleaner - Corded , Black",
      url: "https://www.amazon.com/Bissell-3624-SpotClean-Professional-Portable/dp/B008DBRFBK/ref=sr_1_7",
    },
    {
      title: "BissellSpotClean Pet Pro Portable Carpet Cleaner, 2458",
      url: "https://www.amazon.com/BISSELL-SpotClean-Portable-Cleaner-2458/dp/B07D46SQ63/ref=sr_1_8",
    },
    {
      title: "Bissell2-in-1 Pet Upholstery Tool for Carpet and Upholstery Cleaners (3259)",
      url: "https://www.amazon.com/Bissell-Tool-Carpet-Upholstery-Cleaners/dp/B08Q9Y4ZNQ/ref=sr_1_9",
    },
  ];
  const searchTerm = "Bissell Cleanview XR Pet Vacuum";
  const filteredProducts = await filterProductsWithAI(searchTerm, products);
  console.log(filteredProducts);
}
