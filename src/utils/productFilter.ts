import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const filterProductsWithAI = async (prompt: string): Promise<string[] | null> => {
  try {
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
