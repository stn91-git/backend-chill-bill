import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";
import receiptRoutes from "./routes/receipts";
import './config/firebase';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/receipts", receiptRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
