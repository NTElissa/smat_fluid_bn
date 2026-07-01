import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendSMS } from "./twilioService.js";
import { io } from "../server.js";

export const sendNotification = async ({ userIds, title, message, type, priority = "medium", data = {} }) => {
  try {
    const notifications = [];
    const users = await User.find({ _id: { $in: userIds }, isActive: true });

    for (const user of users) {
      // Create notification in database
      const notification = await Notification.create({
        userId: user._id,
        title,
        message,
        type,
        priority,
        data,
        deliveredVia: []
      });

      // Send via Socket.IO for real-time app notification
      io.to(`user_${user._id}`).emit("notification", {
        id: notification._id,
        title,
        message,
        type,
        priority,
        data,
        createdAt: notification.createdAt
      });

      notification.deliveredVia.push({
        method: "app",
        deliveredAt: new Date(),
        status: "delivered"
      });

      // Send SMS for critical alerts
      if (priority === "high" || type === "alert") {
        try {
          await sendSMS(
            user.phoneNumber,
            `IV Alert: ${title}\n${message}\nPlease check the app for details.`
          );
          
          notification.deliveredVia.push({
            method: "sms",
            deliveredAt: new Date(),
            status: "sent"
          });
        } catch (smsError) {
          console.error("SMS sending failed:", smsError);
          notification.deliveredVia.push({
            method: "sms",
            deliveredAt: new Date(),
            status: "failed"
          });
        }
      }

      await notification.save();
      notifications.push(notification);
    }

    return notifications;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
};

export const markAsRead = async (userId, notificationId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { 
        isRead: true, 
        readAt: new Date() 
      },
      { new: true }
    );
    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

export const getUserNotifications = async (userId, { limit = 50, unreadOnly = false }) => {
  try {
    const query = { userId };
    if (unreadOnly) query.isRead = false;

    const notifications = await Notification.find(query)
      .sort("-createdAt")
      .limit(limit);

    return notifications;
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    throw error;
  }
};