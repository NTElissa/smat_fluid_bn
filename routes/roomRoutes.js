import express from "express";
import mongoose from "mongoose";
import Room from "../models/Room.js";
import User from "../models/User.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { buildRoomQuery, pickRoomUpdateFields, normalizeRoomPayload } from "../utils/roomHelpers.js";

const router = express.Router();

const isValidObjectId = (value) => {
  return Boolean(value) && mongoose.Types.ObjectId.isValid(value);
};

//
// Helper: validate assignedStaff array against real users + roles
//
async function validateAssignedStaff(assignedStaff) {
  if (!Array.isArray(assignedStaff) || assignedStaff.length === 0) {
    return { valid: [], errors: [] };
  }

  const errors = [];
  const valid = [];

  for (const entry of assignedStaff) {
    const { user: userId, role } = entry || {};

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      errors.push(`Invalid user id: ${userId}`);
      continue;
    }

    if (!["doctor", "nurse", "support_staff"].includes(role)) {
      errors.push(`Invalid role "${role}" for user ${userId}`);
      continue;
    }

    const foundUser = await User.findById(userId);

    if (!foundUser) {
      errors.push(`User not found: ${userId}`);
      continue;
    }

    if (foundUser.role !== role) {
      errors.push(
        `User ${foundUser.firstName} ${foundUser.lastName} is a "${foundUser.role}", not "${role}"`
      );
      continue;
    }

    valid.push({ user: foundUser._id, role });
  }

  return { valid, errors };
}

//
// GET ALL ROOMS
//
router.get("/", protect, async (req, res, next) => {
  try {
    const query = buildRoomQuery(req.query);
    const rooms = await Room.find(query)
      .populate("assignedStaff.user", "firstName lastName role")
      .sort("roomNumber");

    res.json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (error) {
    next(error);
  }
});

//
// GET AVAILABLE ROOMS
//
router.get("/available", protect, async (req, res, next) => {
  try {
    const query = {
      isActive: true,
      status: { $ne: "maintenance" },
    };

    if (req.query.ward) query.ward = req.query.ward;
    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;

    const rooms = await Room.find(query)
      .sort({ roomNumber: 1 })
      .populate("assignedStaff.user", "firstName lastName role");

    const availableRooms = rooms.filter((room) => room.currentOccupancy < room.capacity);

    res.json({
      success: true,
      count: availableRooms.length,
      data: availableRooms,
    });
  } catch (error) {
    next(error);
  }
});

//
// GET SINGLE ROOM
//
router.get("/:id", protect, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room id",
      });
    }

    const room = await Room.findById(req.params.id)
      .populate("assignedStaff.user", "firstName lastName role");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
});

//
// CREATE ROOM  (admin can also assign staff at creation time)
//
router.post(
  "/",
  protect,
  authorize("nurse", "doctor", "admin"),
  async (req, res, next) => {
    try {
      const payload = normalizeRoomPayload(req.body);

      const existingRoom = await Room.findOne({
        roomNumber: payload.roomNumber,
        ward: payload.ward,
      });

      if (existingRoom) {
        return res.status(409).json({
          success: false,
          message: "Room already exists in this ward",
        });
      }

      // Only admin is allowed to set assignedStaff on creation
      if (req.user.role === "admin" && req.body.assignedStaff) {
        const { valid, errors } = await validateAssignedStaff(req.body.assignedStaff);

        if (errors.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid staff assignment",
            errors,
          });
        }

        payload.assignedStaff = valid;
      }

      const room = await Room.create(payload);

      res.status(201).json({
        success: true,
        data: room,
      });
    } catch (error) {
      next(error);
    }
  }
);

//
// UPDATE ROOM (general fields — no staff assignment here)
//
router.put("/:id", protect, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room id",
      });
    }

    const payload = pickRoomUpdateFields(req.body);

    if (payload.roomNumber || payload.ward) {
      const existingRoom = await Room.findOne({
        _id: { $ne: req.params.id },
        roomNumber: payload.roomNumber,
        ward: payload.ward,
      });

      if (existingRoom) {
        return res.status(409).json({
          success: false,
          message: "Room already exists in this ward",
        });
      }
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
});

//
// ASSIGN / REPLACE STAFF ON AN EXISTING ROOM (admin only)
//
router.put(
  "/:id/assign-staff",
  protect,
  authorize("admin"),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid room id",
        });
      }

      const { assignedStaff } = req.body;

      const { valid, errors } = await validateAssignedStaff(assignedStaff);

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff assignment",
          errors,
        });
      }

      const room = await Room.findByIdAndUpdate(
        req.params.id,
        { assignedStaff: valid },
        { new: true, runValidators: true }
      ).populate("assignedStaff.user", "firstName lastName role");

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }

      res.json({
        success: true,
        message: "Staff assigned successfully",
        data: room,
      });
    } catch (error) {
      next(error);
    }
  }
);

//
// DELETE ROOM
//
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid room id",
        });
      }

      const room = await Room.findByIdAndDelete(req.params.id);

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }

      res.json({
        success: true,
        message: "Room deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;