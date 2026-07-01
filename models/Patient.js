import mongoose from "mongoose";

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: [true, "Patient ID is required"],
    unique: true,
    trim: true
  },
  firstName: {
    type: String,
    required: [true, "First name is required"],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, "Last name is required"],
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    required: true
  },
  phoneNumber: String,
  address: String,
  emergencyContact: {
    name: String,
    relationship: String,
    phoneNumber: String
  },
  primaryDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  assignedNurseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  ward: String,
  room: String,
  bed: String,
  admissionDate: {
    type: Date,
    default: Date.now
  },
  diagnosis: String,
  allergies: [String],
  currentIVMonitorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "IVMonitor"
  },
  ivHistory: [{
    monitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IVMonitor"
    },
    startTime: Date,
    endTime: Date,
    fluidType: String,
    volume: Number
  }],
  status: {
    type: String,
    enum: ["admitted", "discharged", "transferred"],
    default: "admitted"
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;