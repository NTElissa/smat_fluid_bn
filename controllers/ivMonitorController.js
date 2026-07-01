import IVMonitor from "../models/IVMonitor.js";
import Patient from "../models/Patient.js";
import Alert from "../models/Alert.js";
import { createAlert } from "./alertController.js";
import { sendNotification } from "../services/notificationService.js";

// @desc    Create new IV monitor
// @route   POST /api/iv-monitors
// @access  Private (Nurse/Doctor)
export const createIVMonitor = async (req, res, next) => {
  try {
    const { deviceId, patientId, fluidType, fluidVolume, flowRate, location } = req.body;

    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: "Patient not found" 
      });
    }

    // Check if device already in use
    const existingMonitor = await IVMonitor.findOne({ deviceId, status: "active" });
    if (existingMonitor) {
      return res.status(400).json({ 
        success: false, 
        message: "This device is already in use" 
      });
    }

    // Create monitor
    const monitor = await IVMonitor.create({
      deviceId,
      patientId,
      assignedNurseId: req.user.role === "nurse" ? req.user.id : null,
      assignedDoctorId: req.user.role === "doctor" ? req.user.id : null,
      fluidType,
      fluidVolume,
      flowRate,
      location,
      estimatedEndTime: new Date(Date.now() + (fluidVolume / flowRate) * 60 * 60 * 1000)
    });

    // Update patient with current IV monitor
    patient.currentIVMonitorId = monitor._id;
    await patient.save();

    res.status(201).json({
      success: true,
      data: monitor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all IV monitors
// @route   GET /api/iv-monitors
// @access  Private
export const getIVMonitors = async (req, res, next) => {
  try {
    const { status, patientId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (patientId) query.patientId = patientId;

    // Filter based on user role
    if (req.user.role === "nurse") {
      query.assignedNurseId = req.user.id;
    } else if (req.user.role === "doctor") {
      query.assignedDoctorId = req.user.id;
    }

    const monitors = await IVMonitor.find(query)
      .populate("patientId", "firstName lastName patientId room bed")
      .populate("assignedNurseId", "firstName lastName")
      .populate("assignedDoctorId", "firstName lastName")
      .sort("-createdAt");

    res.json({
      success: true,
      count: monitors.length,
      data: monitors
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single IV monitor
// @route   GET /api/iv-monitors/:id
// @access  Private
export const getIVMonitorById = async (req, res, next) => {
  try {
    const monitor = await IVMonitor.findById(req.params.id)
      .populate("patientId")
      .populate("assignedNurseId", "firstName lastName email phoneNumber")
      .populate("assignedDoctorId", "firstName lastName email phoneNumber");

    if (!monitor) {
      return res.status(404).json({ 
        success: false, 
        message: "IV Monitor not found" 
      });
    }

    res.json({
      success: true,
      data: monitor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update IV monitor reading
// @route   PUT /api/iv-monitors/:id/reading
// @access  Private (Device/System)
export const updateReading = async (req, res, next) => {
  try {
    const { level, flowRate, airBubbleDetected } = req.body;
    
    const monitor = await IVMonitor.findById(req.params.id)
      .populate("patientId")
      .populate("assignedNurseId")
      .populate("assignedDoctorId");

    if (!monitor) {
      return res.status(404).json({ 
        success: false, 
        message: "IV Monitor not found" 
      });
    }

    // Update current reading
    monitor.currentLevel = level;
    monitor.flowRate = flowRate || monitor.flowRate;
    monitor.airBubbleDetected = airBubbleDetected || false;
    
    // Add to readings history
    monitor.readings.push({
      level,
      flowRate: flowRate || monitor.flowRate,
      timestamp: new Date()
    });

    monitor.lastReading = {
      level,
      flowRate: flowRate || monitor.flowRate,
      timestamp: new Date()
    };

    await monitor.save();

    // Check for alerts
    await checkAndCreateAlerts(monitor, level, airBubbleDetected);

    res.json({
      success: true,
      data: monitor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request IV bag change
// @route   POST /api/iv-monitors/:id/request-change
// @access  Private (Nurse/Doctor)
export const requestBagChange = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    const monitor = await IVMonitor.findById(req.params.id)
      .populate("patientId")
      .populate("assignedNurseId");

    if (!monitor) {
      return res.status(404).json({ 
        success: false, 
        message: "IV Monitor not found" 
      });
    }

    // Create alert for bag change
    const alert = await Alert.create({
      monitorId: monitor._id,
      patientId: monitor.patientId._id,
      alertType: "low_level",
      severity: "warning",
      message: `IV bag change requested by ${req.user.firstName} ${req.user.lastName}. Reason: ${reason || "Low level"}`,
      currentValue: monitor.currentLevel,
      threshold: monitor.lowLevelThreshold
    });

    // Send notification to support staff
    await sendNotification({
      userIds: [], // You might want to query support staff
      title: "IV Bag Change Requested",
      message: `Patient ${monitor.patientId.firstName} ${monitor.patientId.lastName} needs IV bag change`,
      type: "task",
      data: {
        monitorId: monitor._id,
        patientId: monitor.patientId._id,
        alertId: alert._id,
        action: "change_iv_bag"
      }
    });

    res.json({
      success: true,
      message: "Bag change request sent to support staff",
      data: alert
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete IV session
// @route   PUT /api/iv-monitors/:id/complete
// @access  Private
export const completeIVSession = async (req, res, next) => {
  try {
    const monitor = await IVMonitor.findById(req.params.id);

    if (!monitor) {
      return res.status(404).json({ 
        success: false, 
        message: "IV Monitor not found" 
      });
    }

    monitor.status = "completed";
    monitor.currentLevel = 0;
    await monitor.save();

    // Update patient's IV history
    await Patient.findByIdAndUpdate(monitor.patientId, {
      $push: {
        ivHistory: {
          monitorId: monitor._id,
          startTime: monitor.startTime,
          endTime: new Date(),
          fluidType: monitor.fluidType,
          volume: monitor.fluidVolume
        }
      },
      currentIVMonitorId: null
    });

    res.json({
      success: true,
      message: "IV session completed",
      data: monitor
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to check and create alerts
const checkAndCreateAlerts = async (monitor, currentLevel, airBubbleDetected) => {
  const alerts = [];

  // Check for low level
  if (currentLevel <= monitor.lowLevelThreshold) {
    const alert = await createAlert({
      monitorId: monitor._id,
      patientId: monitor.patientId._id,
      alertType: "low_level",
      severity: currentLevel <= 10 ? "critical" : "warning",
      message: `IV fluid level is low: ${currentLevel}%`,
      currentValue: currentLevel,
      threshold: monitor.lowLevelThreshold
    });
    alerts.push(alert);
  }

  // Check for air bubbles
  if (airBubbleDetected) {
    const alert = await createAlert({
      monitorId: monitor._id,
      patientId: monitor.patientId._id,
      alertType: "air_bubble",
      severity: "critical",
      message: "Air bubble detected in IV line",
      currentValue: null,
      threshold: null
    });
    alerts.push(alert);
  }

  return alerts;
};