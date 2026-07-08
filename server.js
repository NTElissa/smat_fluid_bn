// server.js - CLEAN & SAFE VERSION

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import ivMonitorRoutes from "./routes/ivMonitorRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
import { setupSocketIO } from "./websocket/socketHandler.js";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:8080",
    methods: ["GET", "POST"],
  },
});

// Setup Socket.IO
setupSocketIO(io);

// =======================
// MIDDLEWARE
// =======================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// ENVIRONMENT-BASED RATE LIMITING
// =======================
const isDevelopment = process.env.NODE_ENV === "development";

// Global API limiter
const apiLimiter = rateLimit({
  windowMs: isDevelopment ? 60 * 1000 : 15 * 60 * 1000, // 1 min dev, 15 min prod
  max: isDevelopment ? 1000 : 100, // 1000 dev, 100 prod
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

// Extra limiter for notifications (DEV ONLY)
if (isDevelopment) {
  const notificationLimiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 50, // 50 requests per 10 seconds
  });

  app.use("/api/notifications", notificationLimiter);
}

// =======================
// ROUTES
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/iv-monitors", ivMonitorRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users", userRoutes);

// =======================
// ERROR HANDLER
// =======================
app.use(errorHandler);

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port http://localhost:${PORT}`);
  console.log(`📌 Environment: ${process.env.NODE_ENV || "development"}`);
});

export { io };