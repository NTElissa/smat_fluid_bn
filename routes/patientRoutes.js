// routes/patientRoutes.js
import express from "express";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import Room from "../models/Room.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// ---------- Room Helpers ----------

async function occupyRoom(roomId, session) {
  const room = await Room.findById(roomId).session(session);
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
  await room.save({ session });
  return room;
}

async function releaseRoom(roomId, session) {
  if (!roomId) return;
  const room = await Room.findById(roomId).session(session);
  if (!room) return;
  room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
  room.status = room.currentOccupancy === 0 ? "available" : "occupied";
  await room.save({ session });
}

async function findAvailableRoom({ ward, type } = {}) {
  const query = {
    isActive: true,
    status: "available",
    $expr: { $lt: ["$currentOccupancy", "$capacity"] },
  };
  if (ward) query.ward = ward;
  if (type) query.type = type;
  return Room.findOne(query).sort({ currentOccupancy: 1 });
}

// ---------- Routes ----------

// GET all patients
router.get("/", protect, async (req, res, next) => {
  try {
    const patients = await Patient.find()
      .populate("primaryDoctorId", "firstName lastName role")
      .populate("assignedNurseId", "firstName lastName role")
      .populate("roomId", "roomNumber ward floor type status currentOccupancy capacity");
    res.json({ success: true, count: patients.length, data: patients });
  } catch (error) {
    next(error);
  }
});

// GET single patient
router.get("/:id", protect, async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate("primaryDoctorId", "firstName lastName role")
      .populate("assignedNurseId", "firstName lastName role")
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
router.post("/", protect, authorize("admin"), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { roomId, ward, roomType, ...rest } = req.body;
    let targetRoomId = roomId;

    if (targetRoomId) {
      await occupyRoom(targetRoomId, session);
    } else if (ward || roomType) {
      const room = await findAvailableRoom({ ward, type: roomType });
      if (!room) {
        const err = new Error("No available room matches the requested ward/type");
        err.statusCode = 409;
        throw err;
      }
      await occupyRoom(room._id, session);
      targetRoomId = room._id;
    }

    const [patient] = await Patient.create(
      [{ ...rest, roomId: targetRoomId || undefined }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const populated = await Patient.findById(patient._id)
      .populate("primaryDoctorId", "firstName lastName role")
      .populate("assignedNurseId", "firstName lastName role")
      .populate("roomId", "roomNumber ward floor type status");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// UPDATE patient
router.put("/:id", protect, authorize("admin"), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const patient = await Patient.findById(req.params.id).session(session);
    if (!patient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const newRoomId = req.body.roomId;
    const oldRoomId = patient.roomId ? patient.roomId.toString() : null;
    const roomFieldTouched = Object.prototype.hasOwnProperty.call(req.body, "roomId");

    if (roomFieldTouched && newRoomId !== oldRoomId) {
      if (newRoomId) await occupyRoom(newRoomId, session);
      if (oldRoomId) await releaseRoom(oldRoomId, session);
    }

    Object.assign(patient, req.body);
    await patient.validate();
    await patient.save({ session });

    await session.commitTransaction();
    session.endSession();

    const populated = await Patient.findById(patient._id)
      .populate("primaryDoctorId", "firstName lastName role")
      .populate("assignedNurseId", "firstName lastName role")
      .populate("roomId", "roomNumber ward floor type status");

    res.json({ success: true, data: populated });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// DELETE patient
router.delete("/:id", protect, authorize("admin"), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const patient = await Patient.findById(req.params.id).session(session);
    if (!patient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    if (patient.roomId) {
      await releaseRoom(patient.roomId, session);
    }

    await Patient.findByIdAndDelete(req.params.id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: "Patient deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
});

export default router;