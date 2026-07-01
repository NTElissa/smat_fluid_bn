// import express from "express";
// import { 
//   getAlerts,
//   getActiveAlerts,
//   acknowledgeAlert,
//   resolveAlert
// } from "../controllers/alertController.js";
// import { protect } from "../middleware/authMiddleware.js";

// const router = express.Router();

// router.get("/", protect, getAlerts);
// router.get("/active", protect, getActiveAlerts);
// router.put("/:id/acknowledge", protect, acknowledgeAlert);
// router.put("/:id/resolve", protect, resolveAlert);

// export default router;


// routes/alertRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Alert from "../models/Alert.js"; // ← ADD THIS

const router = express.Router();

// @desc    Get all alerts
// @route   GET /api/alerts
// @access  Private
router.get("/", protect, async (req, res, next) => {
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
});

// @desc    Get active alerts
// @route   GET /api/alerts/active
// @access  Private
router.get("/active", protect, async (req, res, next) => {
  try {
    const alerts = await Alert.find({ 
      status: { $in: ["active", "acknowledged"] } 
    })
      .populate("patientId", "firstName lastName patientId room bed")
      .populate("monitorId", "deviceId")
      .sort("-severity -createdAt");

    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single alert
// @route   GET /api/alerts/:id
// @access  Private
router.get("/:id", protect, async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate("patientId")
      .populate("monitorId")
      .populate("acknowledgedBy", "firstName lastName email")
      .populate("resolvedBy", "firstName lastName email");

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found"
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Acknowledge alert
// @route   PUT /api/alerts/:id/acknowledge
// @access  Private
router.put("/:id/acknowledge", protect, async (req, res, next) => {
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
});

// @desc    Resolve alert
// @route   PUT /api/alerts/:id/resolve
// @access  Private
router.put("/:id/resolve", protect, async (req, res, next) => {
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
});

export default router;