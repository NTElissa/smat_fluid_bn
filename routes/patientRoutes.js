// server/routes/patientRoutes.js
import express from "express";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import Room from "../models/Room.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// ---------- Room helpers (no sessions — standalone MongoDB safe) ----------

async function occupyRoom(roomId) {
  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId.toString())) {
    const err = new Error("Invalid room id");
    err.statusCode = 400;
    throw err;
  }

  const room = await Room.findById(roomId);

  if (!room) {
    const err = new Error("Room not found");
    err.statusCode = 404;
    throw err;
  }
  if (!room.isActive || room.status === "maintenance") {
    const err = new Error("Room is not available for assignment");
    err.statusCode = 400;
    throw err;
  }
  if (room.currentOccupancy >= room.capacity) {
    const err = new Error("Room is already at full capacity");
    err.statusCode = 400;
    throw err;
  }

  room.currentOccupancy += 1;
  room.status = "occupied";
  await room.save();

  return room;
}

async function releaseRoom(roomId) {
  if (!roomId) return;

  const normalizedRoomId = roomId.toString();
  if (!mongoose.Types.ObjectId.isValid(normalizedRoomId)) return;

  const room = await Room.findById(normalizedRoomId);
  if (!room) return;

  room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
  room.status = room.currentOccupancy === 0 ? "available" : "occupied";
  await room.save();
}

async function findAvailableRoom({ ward, type } = {}) {
  const query = {
    isActive: true,
    status: { $in: ["available", "occupied"] },
    $expr: { $lt: ["$currentOccupancy", "$capacity"] },
  };

  if (ward) query.ward = ward;
  if (type) query.type = type;

  return Room.findOne(query).sort({ currentOccupancy: 1 });
}

// ---------- Routes ----------

// GET all patients with stats
router.get("/stats", protect, async (req, res, next) => {
  try {
    const stats = await Patient.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          admitted: { $sum: { $cond: [{ $eq: ["$status", "admitted"] }, 1, 0] } },
          discharged: { $sum: { $cond: [{ $eq: ["$status", "discharged"] }, 1, 0] } },
          transferred: { $sum: { $cond: [{ $eq: ["$status", "transferred"] }, 1, 0] } },
          male: { $sum: { $cond: [{ $eq: ["$gender", "male"] }, 1, 0] } },
          female: { $sum: { $cond: [{ $eq: ["$gender", "female"] }, 1, 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        total: 0,
        admitted: 0,
        discharged: 0,
        transferred: 0,
        male: 0,
        female: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET all patients
router.get("/", protect, async (req, res, next) => {
  try {
    const { ward, status, gender, search } = req.query;
    const query = {};

    if (ward && ward !== "all") query.ward = ward;
    if (status && status !== "all") query.status = status;
    if (gender && gender !== "all") query.gender = gender;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
      ];
    }

    const patients = await Patient.find(query)
      .populate("primaryDoctorId", "firstName lastName role email")
      .populate("assignedNurseId", "firstName lastName role email")
      .populate("roomId", "roomNumber ward floor type status currentOccupancy capacity")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: patients.length, data: patients });
  } catch (error) {
    next(error);
  }
});

// GET single patient
router.get("/:id", protect, async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate("primaryDoctorId", "firstName lastName role email")
      .populate("assignedNurseId", "firstName lastName role email")
      .populate("roomId", "roomNumber ward floor type status currentOccupancy capacity");

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    res.json({ success: true, data: patient });
  } catch (error) {
    next(error);
  }
});

// CREATE patient
// NOTE: No MongoDB session/transaction here — standalone mongod instances
// (i.e. not a replica set) throw "Transaction numbers are only allowed on
// a replica set member or mongos" as soon as a session is opened.
// Instead we do the room step first and manually roll it back if patient
// creation fails, so we never leave a room "occupied" for nothing.
router.post("/", protect, authorize("admin", "doctor"), async (req, res, next) => {
  let occupiedRoomId = null;

  try {
    const { roomId, ward, roomType, ...patientData } = req.body;
    let targetRoomId = roomId;

    if (targetRoomId) {
      await occupyRoom(targetRoomId);
      occupiedRoomId = targetRoomId;
    } else if (ward || roomType) {
      const room = await findAvailableRoom({ ward, type: roomType });
      if (!room) {
        const err = new Error("No available room matches the requested criteria");
        err.statusCode = 409;
        throw err;
      }
      await occupyRoom(room._id);
      targetRoomId = room._id;
      occupiedRoomId = room._id;
    }

    let patient;
    try {
      patient = await Patient.create({
        ...patientData,
        roomId: targetRoomId || undefined,
        admissionDate: patientData.admissionDate || new Date(),
      });
    } catch (createErr) {
      // Roll back the room occupancy bump since the patient was never created
      if (occupiedRoomId) {
        await releaseRoom(occupiedRoomId).catch(() => {});
      }
      throw createErr;
    }

    const populated = await Patient.findById(patient._id)
      .populate("primaryDoctorId", "firstName lastName role email")
      .populate("assignedNurseId", "firstName lastName role email")
      .populate("roomId", "roomNumber ward floor type status currentOccupancy capacity");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    // Mongoose validation errors -> 400 with a readable message
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate value violates a unique field" });
    }
    next(error);
  }
});

// UPDATE patient
router.put("/:id", protect, authorize("admin", "doctor"), async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const newRoomId = req.body.roomId;
    const oldRoomId = patient.roomId ? patient.roomId.toString() : null;
    let roomChanged = false;

    if (newRoomId !== undefined && newRoomId !== oldRoomId) {
      if (newRoomId) {
        await occupyRoom(newRoomId);
        roomChanged = true;
      }
      if (oldRoomId) {
        await releaseRoom(oldRoomId);
      }
    }

    try {
      Object.assign(patient, req.body);
      await patient.validate();
      await patient.save();
    } catch (saveErr) {
      // Roll back the new room occupancy bump if the save failed
      if (roomChanged && newRoomId) {
        await releaseRoom(newRoomId).catch(() => {});
      }
      throw saveErr;
    }

    const populated = await Patient.findById(patient._id)
      .populate("primaryDoctorId", "firstName lastName role email")
      .populate("assignedNurseId", "firstName lastName role email")
      .populate("roomId", "roomNumber ward floor type status currentOccupancy capacity");

    res.json({ success: true, data: populated });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// DELETE patient
router.delete("/:id", protect, authorize("admin"), async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    if (patient.roomId) {
      await releaseRoom(patient.roomId);
    }

    await Patient.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Patient deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// Example backend route for rooms
router.get("/rooms", protect, async (req, res) => {
  try {
    const { ward, type, status } = req.query;
    const query = { isActive: true };

    if (ward) query.ward = ward;
    if (type) query.type = type;
    if (status) query.status = status;

    const rooms = await Room.find(query).sort({ roomNumber: 1 });
    res.json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;