import dotenv from 'dotenv';
import path from 'path';

// Load environment variables first
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Then import firebase config which uses these env vars
import './config/firebase';
import express from 'express';
import cors from "cors";
import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";
import receiptRoutes from "./routes/receipts";

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/receipts", receiptRoutes);



// Error handling middleware (add this at the end)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something broke!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
