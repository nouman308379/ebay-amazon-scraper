import express from "express";
import { getProduct } from "../controllers/products.js";
const router = express.Router();

// Example route to get all products
router.get("/", getProduct);

export default router;
