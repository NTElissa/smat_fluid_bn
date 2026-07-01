import express from "express";
import Patient from "../models/Patient.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

//
// GET ALL PATIENTS
//
router.get("/", protect, async (req, res, next) => {
  try {
    const patients = await Patient.find()
      .populate("primaryDoctorId", "firstName lastName role")
      .populate("assignedNurseId", "firstName lastName role");

    res.json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
});

//
// GET SINGLE PATIENT
//
router.get("/:id", protect, async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate("primaryDoctorId", "firstName lastName role")
      .populate("assignedNurseId", "firstName lastName role");

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
});

//
// CREATE PATIENT
//
router.post(
  "/",
  protect,
  authorize("nurse", "doctor", "admin"),
  async (req, res, next) => {
    try {
      const patient = await Patient.create(req.body);

      res.status(201).json({
        success: true,
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }
);

//
// UPDATE PATIENT
//
router.put("/:id", protect, async (req, res, next) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
});

//
// DELETE PATIENT
//
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  async (req, res, next) => {
    try {
      const patient = await Patient.findByIdAndDelete(req.params.id);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      res.json({
        success: true,
        message: "Patient deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;