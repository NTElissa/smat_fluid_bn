import Alert from "../models/Alert.js";
import { sendNotification } from "../services/notificationService.js";

// @desc    Get all alerts
// @route   GET /api/alerts
// @access  Private
export const getAlerts = async (req, res, next) => {
  try {
    const { status, severity, patientId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (patientId) query.patientId = patientId;

    const alerts = await Alert.find(query)
      .populate("patientId", "firstName lastName patientId room bed")
      .populate("monitorId", "deviceId fluidType")
      .populate("acknowledgedBy", "firstName lastName")
      .populate("resolvedBy", "firstName lastName")
      .sort("-createdAt");

    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new alert
// @route   POST /api/alerts
// @access  Private (System)
export const createAlert = async (alertData) => {
  try {
    const alert = await Alert.create(alertData);

    // Get users to notify (nurses and doctors assigned to this patient)
    const monitor = await alertData.monitorId ? 
      await alertData.monitorId.populate("assignedNurseId assignedDoctorId") : 
      null;

    const userIds = [];
    if (monitor) {
      if (monitor.assignedNurseId) userIds.push(monitor.assignedNurseId._id);
      if (monitor.assignedDoctorId) userIds.push(monitor.assignedDoctorId._id);
    }

    // Send notifications
    await sendNotification({
      userIds,
      title: `IV Alert: ${alert.alertType.replace("_", " ").toUpperCase()}`,
      message: alert.message,
      type: "alert",
      priority: alert.severity === "critical" ? "high" : "medium",
      data: {
        alertId: alert._id,
        monitorId: alert.monitorId,
        patientId: alert.patientId,
        severity: alert.severity
      }
    });

    return alert;
  } catch (error) {
    console.error("Error creating alert:", error);
    throw error;
  }
};

// @desc    Acknowledge alert
// @route   PUT /api/alerts/:id/acknowledge
// @access  Private
export const acknowledgeAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        message: "Alert not found" 
      });
    }

    alert.status = "acknowledged";
    alert.acknowledgedBy = req.user.id;
    alert.acknowledgedAt = Date.now();

    await alert.save();

    res.json({
      success: true,
      message: "Alert acknowledged",
      data: alert
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve alert
// @route   PUT /api/alerts/:id/resolve
// @access  Private
export const resolveAlert = async (req, res, next) => {
  try {
    const { resolutionNotes } = req.body;
    
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        message: "Alert not found" 
      });
    }

    alert.status = "resolved";
    alert.resolvedBy = req.user.id;
    alert.resolvedAt = Date.now();
    alert.resolutionNotes = resolutionNotes;

    await alert.save();

    res.json({
      success: true,
      message: "Alert resolved",
      data: alert
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active alerts
// @route   GET /api/alerts/active
// @access  Private
export const getActiveAlerts = async (req, res, next) => {
  try {
    const alerts = await Alert.find({ 
      status: { $in: ["active", "acknowledged"] } 
    })
      .populate("patientId", "firstName lastName patientId room bed")
      .populate("monitorId", "deviceId")
      .sort("-severity createdAt");

    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
};