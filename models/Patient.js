const mongoose = require("mongoose")

const patientSchema = new mongoose.Schema(
  {
    cid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
    },
    gender: {
      type: String,
      required: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    chiefComplaint: {
      type: String,
      required: true,
      trim: true,
    },
    tokenNumber: {
      type: String,
      required: true,
    },
    chamber: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    queueNumber: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "in-progress", "completed", "cancelled"],
      default: "waiting",
    },
    priority: {
      type: String,
      enum: ["normal", "urgent", "emergency"],
      default: "normal",
    },
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    calledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
)

patientSchema.index({ cid: 1 })

module.exports = mongoose.model("Patient", patientSchema)
