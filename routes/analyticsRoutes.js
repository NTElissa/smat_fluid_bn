import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Patient from "../models/Patient.js";
import Alert from "../models/Alert.js";
import IVMonitor from "../models/IVMonitor.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/dashboard", protect, async (req, res, next) => {
  try {
    const [patients, activeAlerts, activeMonitors, users] = await Promise.all([
      Patient.countDocuments({ status: { $ne: "discharged" } }),
      Alert.countDocuments({ status: "active" }),
      IVMonitor.countDocuments({ status: { $in: ["active", "alert"] } }),
      User.countDocuments({ isActive: true }),
    ]);

    const doctors = await User.countDocuments({ role: "doctor", isActive: true });
    const nurses = await User.countDocuments({ role: "nurse", isActive: true });
    const supportStaff = await User.countDocuments({ role: "support_staff", isActive: true });
    const admins = await User.countDocuments({ role: "admin", isActive: true });

    res.json({
      success: true,
      data: {
        patients,
        activeAlerts,
        activeMonitors,
        totalUsers: users,
        doctors,
        nurses,
        supportStaff,
        admins,
        completedToday: 0,
        completionRate: 92,
        avgResponseTime: "4m",
        staffOnDuty: users,
        activities: [
          {
            type: "alert",
            message: "New alert requires attention",
            timestamp: new Date().toISOString(),
          },
          {
            type: "monitor",
            message: "IV monitor status updated",
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/weekly", protect, async (req, res, next) => {
  try {
    const recent = [
      { name: "Mon", patients: 8, alerts: 2 },
      { name: "Tue", patients: 10, alerts: 3 },
      { name: "Wed", patients: 7, alerts: 1 },
      { name: "Thu", patients: 12, alerts: 4 },
      { name: "Fri", patients: 9, alerts: 2 },
      { name: "Sat", patients: 6, alerts: 1 },
      { name: "Sun", patients: 11, alerts: 3 },
    ];

    res.json({ success: true, data: recent });
  } catch (error) {
    next(error);
  }
});

router.get("/patients", protect, async (req, res, next) => {
  try {
    const totalBeds = 120;
    const occupiedBeds = await Patient.countDocuments({ status: { $ne: "discharged" } });

    res.json({
      success: true,
      data: {
        bedsAvailable: Math.max(totalBeds - occupiedBeds, 0),
        totalBeds,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
