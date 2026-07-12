import mongoose from "mongoose";

const ivMonitorSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: [true, "Device ID is required"],
    unique: true,
    trim: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  assignedNurseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  assignedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  fluidType: {
    type: String,
    required: true,
    enum: ["Saline", "Dextrose", "Ringer's Lactate", "Other"]
  },
  fluidVolume: {
    type: Number, // in ml
    required: true
  },
  currentLevel: {
    type: Number, // percentage
    min: 0,
    max: 100,
    default: 100
  },
  flowRate: {
    type: Number, // ml per hour
    required: true
  },
  status: {
    type: String,
    enum: ["active", "paused", "completed", "alert"],
    default: "active"
  },
  lowLevelThreshold: {
    type: Number,
    default: 20 // percentage
  },
  highLevelThreshold: {
    type: Number,
    default: 95 // percentage
  },
  airBubbleDetected: {
    type: Boolean,
    default: false
  },
  lastReading: {
    level: Number,
    flowRate: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  readings: [{
    level: Number,
    flowRate: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  startTime: {
    type: Date,
    default: Date.now
  },
  estimatedEndTime: Date,
  location: {
    ward: String,
    room: String,
    bed: String
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate estimated end time before saving
ivMonitorSchema.pre("save", function(next) {
  const hasValidFlowRate = typeof this.flowRate === "number" && this.flowRate > 0;
  const hasValidVolume = typeof this.fluidVolume === "number" && this.fluidVolume > 0;

  if (this.isModified("currentLevel") || this.isModified("flowRate") || this.isModified("fluidVolume")) {
    if (hasValidFlowRate && hasValidVolume && this.currentLevel > 0) {
      const remainingFluid = (this.currentLevel / 100) * this.fluidVolume;
      const hoursRemaining = remainingFluid / this.flowRate;
      this.estimatedEndTime = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);
    } else {
      this.estimatedEndTime = null;
    }
  }

  // next();
});

const IVMonitor = mongoose.model("IVMonitor", ivMonitorSchema);
export default IVMonitor;