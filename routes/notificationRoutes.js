// routes/notificationRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Notification from "../models/Notification.js"; // ← THIS WAS MISSING

const router = express.Router();

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get("/", protect, async (req, res, next) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;
    
    // Build query
    let query = { userId: req.user.id };
    if (unreadOnly === "true" || unreadOnly === true) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort("-createdAt")
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create test notification
// @route   POST /api/notifications/test-create
// @access  Private
router.post("/test-create", protect, async (req, res, next) => {
  try {
    const notification = await Notification.create({
      userId: req.user.id,
      title: req.body.title || "Test Notification",
      message: req.body.message || "This is a test notification from the IV monitoring system",
      type: req.body.type || "update",
      priority: req.body.priority || "medium",
      data: req.body.data || { test: true, timestamp: new Date().toISOString() }
    });

    res.status(201).json({
      success: true,
      message: "Test notification created",
      data: notification
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put("/:id/read", protect, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { 
        isRead: true, 
        readAt: new Date() 
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
router.put("/mark-all-read", protect, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );

    res.json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete("/:id", protect, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (error) {
    next(error);
  }
});

export default router;