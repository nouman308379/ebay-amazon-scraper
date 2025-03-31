import { Request, Response } from "express";
import axios from "axios";
import { JSDOM } from "jsdom";

const fetchFromUrl = async (url: string): Promise<any> => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching data from URL:", error);
    throw new Error("Failed to fetch data from the provided URL");
  }
};

export const getProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const product = req.query.product as string;

    let response;
    for (let i = 0; i < 1; i++) {
      response = await fetchFromUrl(
        `https://www.amazon.com/s?k=${product}&page${i + 1}`
      );
    }

    // const dom = new JSDOM(response);
    // const document = dom.window.document;
    // const links = Array.from(document.querySelectorAll(".s-line-clamp-2"))

    // console.log("Extracted product titles:", links);

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
