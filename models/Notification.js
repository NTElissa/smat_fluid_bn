import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["alert", "reminder", "update", "task"],
    required: true
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  data: {
    monitorId: mongoose.Schema.Types.ObjectId,
    patientId: mongoose.Schema.Types.ObjectId,
    alertId: mongoose.Schema.Types.ObjectId,
    action: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  deliveredVia: [{
    method: {
      type: String,
      enum: ["sms", "push", "email", "app"]
    },
    deliveredAt: Date,
    status: {
      type: String,
      enum: ["sent", "delivered", "failed"],
      default: "sent"
    }
  }],
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;