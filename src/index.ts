import express from "express";
import router from "./routes/products.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use("/products", router);

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`listening on PORT ${PORT}`);
});
