export interface Product {
  title: string;
  url: string;
}

export interface DetailedProduct extends Product {
  price?: string;
  description?: string;
  bulletPoints?: string[];
  features?: Record<string, string>;
  imageUrls?: string[];
}
