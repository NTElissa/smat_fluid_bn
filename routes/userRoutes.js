import express from "express";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, async (req, res, next) => {
  try {
    const role = req.query.role;
    const query = role ? { role, isActive: true } : { isActive: true };

    const users = await User.find(query)
      .select("-password")
      .sort({ firstName: 1, lastName: 1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
