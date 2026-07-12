import IVMonitor from "../models/IVMonitor.js";
import Patient from "../models/Patient.js";
import Alert from "../models/Alert.js";
import { createAlert } from "./alertController.js";
import { sendNotification } from "../services/notificationService.js";

const normalizeLocation = (location = {}) => ({
  ward: location.ward?.trim() || "",
  room: location.room?.trim() || "",
  bed: location.bed?.trim() || ""
});

const getMonitorStatus = ({ currentLevel, airBubbleDetected, lowLevelThreshold }) => {
  if (airBubbleDetected) return "alert";
  if (currentLevel <= 0) return "completed";
  if (currentLevel <= lowLevelThreshold) return "alert";
  return "active";
};

// @desc    Create new IV monitor
// @route   POST /api/iv-monitors
// @access  Private (Nurse/Doctor)
export const createIVMonitor = async (req, res, next) => {
  try {
    const { deviceId, patientId, fluidType, fluidVolume, flowRate, location, currentLevel = 100, airBubbleDetected = false } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient is required"
      });
    }

    const normalizedDeviceId = deviceId?.toString().trim().toUpperCase();
    const normalizedFluidType = fluidType?.toString().trim();
    const normalizedFluidVolume = Number(fluidVolume);
    const normalizedFlowRate = Number(flowRate);
    const normalizedCurrentLevel = Math.min(100, Math.max(0, Number(currentLevel) || 100));

    if (!normalizedDeviceId) {
      return res.status(400).json({ success: false, message: "Device ID is required" });
    }

    if (!normalizedFluidType) {
      return res.status(400).json({ success: false, message: "Fluid type is required" });
    }

    if (!Number.isFinite(normalizedFluidVolume) || normalizedFluidVolume <= 0) {
      return res.status(400).json({ success: false, message: "Fluid volume must be greater than 0" });
    }

    if (!Number.isFinite(normalizedFlowRate) || normalizedFlowRate <= 0) {
      return res.status(400).json({ success: false, message: "Flow rate must be greater than 0" });
    }

    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    if (patient.currentIVMonitorId) {
      const activeMonitor = await IVMonitor.findById(patient.currentIVMonitorId);
      if (activeMonitor && ["active", "alert", "paused"].includes(activeMonitor.status)) {
        return res.status(409).json({
          success: false,
          message: "Patient already has an active IV monitor"
        });
      }
    }

    // Check if device already in use
    const existingMonitor = await IVMonitor.findOne({ deviceId: normalizedDeviceId, status: "active" });
    if (existingMonitor) {
      return res.status(400).json({
        success: false,
        message: "This device is already in use"
      });
    }

    const initialLocation = normalizeLocation(location);
    const monitor = await IVMonitor.create({
      deviceId: normalizedDeviceId,
      patientId,
      assignedNurseId: req.user.role === "nurse" ? req.user.id : null,
      assignedDoctorId: req.user.role === "doctor" ? req.user.id : null,
      fluidType: normalizedFluidType,
      fluidVolume: normalizedFluidVolume,
      flowRate: normalizedFlowRate,
      currentLevel: normalizedCurrentLevel,
      status: getMonitorStatus({ currentLevel: normalizedCurrentLevel, airBubbleDetected: Boolean(airBubbleDetected), lowLevelThreshold: 20 }),
      airBubbleDetected: Boolean(airBubbleDetected),
      location: initialLocation,
      lastReading: {
        level: normalizedCurrentLevel,
        flowRate: normalizedFlowRate,
        timestamp: new Date()
      },
      readings: [{
        level: normalizedCurrentLevel,
        flowRate: normalizedFlowRate,
        timestamp: new Date()
      }],
      estimatedEndTime: new Date(Date.now() + (normalizedFluidVolume / normalizedFlowRate) * 60 * 60 * 1000)
    });

    // Update patient with current IV monitor
    patient.currentIVMonitorId = monitor._id;
    patient.ivHistory.push({
      monitorId: monitor._id,
      startTime: monitor.startTime,
      fluidType: monitor.fluidType,
      volume: monitor.fluidVolume
    });
    await patient.save();

    res.status(201).json({
      success: true,
      data: monitor,
      patient: {
        id: patient._id,
        currentIVMonitorId: patient.currentIVMonitorId
      }
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
      .populate({
        path: "patientId",
        select: "firstName lastName patientId diagnosis roomId",
        populate: {
          path: "roomId",
          select: "ward roomNumber floor type status"
        }
      })
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
    const normalizedLevel = Number(level);
    const normalizedFlowRate = Number(flowRate ?? "");
    const normalizedAirBubbleDetected = Boolean(airBubbleDetected);

    if (!Number.isFinite(normalizedLevel)) {
      return res.status(400).json({ success: false, message: "A valid reading level is required" });
    }

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

    monitor.currentLevel = Math.min(100, Math.max(0, normalizedLevel));
    monitor.flowRate = Number.isFinite(normalizedFlowRate) && normalizedFlowRate > 0 ? normalizedFlowRate : monitor.flowRate;
    monitor.airBubbleDetected = normalizedAirBubbleDetected;
    monitor.status = getMonitorStatus({
      currentLevel: monitor.currentLevel,
      airBubbleDetected: monitor.airBubbleDetected,
      lowLevelThreshold: monitor.lowLevelThreshold
    });

    monitor.readings.push({
      level: monitor.currentLevel,
      flowRate: monitor.flowRate,
      timestamp: new Date()
    });

    monitor.lastReading = {
      level: monitor.currentLevel,
      flowRate: monitor.flowRate,
      timestamp: new Date()
    };

    await monitor.save();

    // Check for alerts
    await checkAndCreateAlerts(monitor, monitor.currentLevel, monitor.airBubbleDetected);

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
    monitor.airBubbleDetected = false;
    monitor.lastReading = {
      level: 0,
      flowRate: monitor.flowRate,
      timestamp: new Date()
    };
    monitor.estimatedEndTime = new Date();
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
// controllers/ivMonitorController.js - verify the getAssignablePatients function
export const getAssignablePatients = async (req, res, next) => {
  try {
    // Get all admitted patients with their current IV monitor status
    const patients = await Patient.find({ 
      status: { $in: ['admitted', 'transferred'] } 
    })
      .populate('roomId', 'ward roomNumber floor type status')
      .populate('currentIVMonitorId', 'deviceId status currentLevel')
      .select('firstName lastName patientId diagnosis roomId currentIVMonitorId status bed')
      .sort({ firstName: 1, lastName: 1 })

    console.log(`Found ${patients.length} patients`) // Debug log

    const data = patients.map((patient) => {
      const patientObj = patient.toObject()
      
      // Check if patient has an active monitor
      const hasActiveMonitor = Boolean(
        patient.currentIVMonitorId && 
        ['active', 'alert', 'paused'].includes(patient.currentIVMonitorId.status)
      )
      
      return {
        ...patientObj,
        hasActiveMonitor,
        monitorStatus: patient.currentIVMonitorId?.status || null,
        isAvailable: !hasActiveMonitor,
        location: patient.roomId ? {
          ward: patient.roomId.ward,
          room: patient.roomId.roomNumber,
          bed: patient.bed || ''
        } : null
      }
    })

    res.json({
      success: true,
      count: data.length,
      data
    })
  } catch (error) {
    console.error('Error fetching assignable patients:', error)
    next(error)
  }
};