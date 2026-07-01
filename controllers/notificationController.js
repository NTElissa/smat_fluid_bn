// controllers/notificationController.js
import Notification from "../models/Notification.js";

// @desc    Create test notification
// @route   POST /api/notifications/test-create
// @access  Private
export const createTestNotification = async (req, res, next) => {
  try {
    const notification = await Notification.create({
      userId: req.user.id,
      title: "Test Notification",
      message: "This is a test notification from the IV monitoring system",
      type: "update",
      priority: "medium",
      data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });

    res.status(201).json({
      success: true,
      message: "Test notification created",
      data: notification
    });
  } catch (error) {
    next(error);
  }
};