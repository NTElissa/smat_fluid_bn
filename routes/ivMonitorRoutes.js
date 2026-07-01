import express from "express";
import { 
  createIVMonitor,
  getIVMonitors,
  getIVMonitorById,
  updateReading,
  requestBagChange,
  completeIVSession
} from "../controllers/ivMonitorController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { validateIVMonitor } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.route("/")
  .post(protect, authorize("nurse", "doctor", "admin"), validateIVMonitor, createIVMonitor)
  .get(protect, getIVMonitors);

router.get("/:id", protect, getIVMonitorById);
router.put("/:id/reading", protect, updateReading);
router.post("/:id/request-change", protect, authorize("nurse", "doctor"), requestBagChange);
router.put("/:id/complete", protect, authorize("nurse", "doctor", "admin"), completeIVSession);

export default router;