import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: [true, "Room number is required"],
    trim: true
  },
  ward: {
    type: String,
    required: [true, "Ward is required"],
    trim: true
  },
  floor: {
    type: String,
    trim: true
  },
  capacity: {
    type: Number,
    default: 1
  },
  currentOccupancy: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ["available", "occupied", "maintenance", "reserved"],
    default: "available"
  },
  type: {
    type: String,
    enum: ["general", "icu", "maternity", "pediatric", "surgery"],
    default: "general"
  },
  amenities: [String],
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  },

  // NEW: staff assigned to this room (doctor, nurse, support_staff)
  assignedStaff: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      role: {
        type: String,
        enum: ["doctor", "nurse", "support_staff"],
        required: true
      },
      assignedAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, {
  timestamps: true
});

roomSchema.index({ roomNumber: 1, ward: 1 }, { unique: true });

const Room = mongoose.model("Room", roomSchema);
export default Room;