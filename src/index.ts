import express from "express";
import router from "./routes/products";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use("/products", router);

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

app.listen(8000, () => {
  console.log("Server is running on http://localhost:8000");
});
