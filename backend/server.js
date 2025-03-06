require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const admin = require("firebase-admin");

// 🔹 Initialize Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((error) => console.error("❌ MongoDB Connection Failed:", error));

// ✅ Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  imageUrl: String,
});
const Product = mongoose.model("Product", productSchema);

// ✅ Middleware: Verify Firebase Token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;

    // 🔹 Fetch user role from Firestore
    const userRef = admin.firestore().collection("users").doc(decodedToken.uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) req.user.role = userSnap.data().role;

    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token", error });
  }
};

// ✅ Middleware: Check Admin Role
const checkAdminRole = (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied: Admins only" });
  next();
};

// ✅ Get All Products (Public API)
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch products", error });
  }
});

// ✅ Add Product (Admins Only)
app.post("/api/products", verifyToken, checkAdminRole, async (req, res) => {
  try {
    const { name, price, description, imageUrl } = req.body;
    const newProduct = new Product({ name, price, description, imageUrl });
    await newProduct.save();
    res.status(201).json({ success: true, message: "Product added successfully", product: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to add product", error });
  }
});

// ✅ Delete Product (Admins Only)
app.delete("/api/products/:id", verifyToken, checkAdminRole, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete product", error });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
