import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
  monitorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "IVMonitor",
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  alertType: {
    type: String,
    enum: ["low_level", "high_level", "air_bubble", "flow_rate_abnormal", "completed", "disconnected"],
    required: true
  },
  severity: {
    type: String,
    enum: ["info", "warning", "critical"],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  currentValue: Number,
  threshold: Number,
  status: {
    type: String,
    enum: ["active", "acknowledged", "resolved", "false_alarm"],
    default: "active"
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  acknowledgedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  resolvedAt: Date,
  notifiedUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    notifiedAt: Date,
    method: {
      type: String,
      enum: ["sms", "push", "email", "app"]
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Alert = mongoose.model("Alert", alertSchema);
export default Alert;