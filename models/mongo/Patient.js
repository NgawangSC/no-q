const mongoose = require('mongoose')

const patientSchema = new mongoose.Schema(
  {
    cid: { type: String, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    dob: { type: Date, required: true },

    chiefComplaint: { type: String, required: true },
    tokenNumber: { type: Number, required: true },
    // Reference to Chamber by ObjectId
    chamber: { type: mongoose.Schema.Types.ObjectId, ref: 'Chamber', required: true },

    queueNumber: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ['waiting', 'in-progress', 'called', 'completed', 'cancelled'], 
      default: 'waiting' 
    },

    phone: { type: String },
    reason: { type: String },
    priority: { 
      type: String, 
      enum: ['normal', 'urgent', 'emergency'], 
      default: 'normal' 
    },

    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    prescription: { type: String },

    visitHistory: [
      {
        visitDate: Date,
        status: String,
        chiefComplaint: String,
        // Historical snapshot of the chamber as stored at visit time
        chamber: { type: mongoose.Schema.Types.ObjectId, ref: 'Chamber' },
        tokenNumber: Number,
        doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }
      }
    ]
  },
  {
    timestamps: { 
      createdAt: 'createdAt', 
      updatedAt: 'updatedAt' 
    }
  }
)

// Create indexes for frequently queried fields
patientSchema.index({ cid: 1 }, { unique: true })
patientSchema.index({ status: 1, queueNumber: 1 })
patientSchema.index({ chamber: 1, tokenNumber: 1 })

// Create the model
const Patient = mongoose.model('Patient', patientSchema)

// Helper functions
async function createPatient(data) {
  const patient = new Patient(data)
  return await patient.save()
}

async function findByCid(cid) {
  return await Patient.findOne({ cid }).exec()
}

async function findById(id) {
  return await Patient.findById(id).exec()
}

async function findAllByStatus(status) {
  const query = status ? { status } : {}
  return await Patient.find(query).sort({ queueNumber: 1 }).exec()
}

async function getNextQueueNumber() {
  const last = await Patient.findOne().sort({ queueNumber: -1 }).exec()
  return last ? last.queueNumber + 1 : 1
}

async function getNextTokenForChamber(chamberId) {
  if (!chamberId) {
    throw new Error('Chamber id is required to get next token')
  }

  const last = await Patient.findOne({ chamber: chamberId })
    .sort({ tokenNumber: -1 })
    .exec()
  return last ? last.tokenNumber + 1 : 1
}

async function findAll(status) {
  const query = status ? { status } : {};
  return await Patient.find(query)
    .sort({ queueNumber: 1, tokenNumber: 1 })
    .exec();
}

async function updateStatus(id, status) {
  const update = { status };
  const pushUpdate = {};

  if (status === 'in-progress') {
    update.calledAt = new Date();
  } else if (status === 'completed') {
    update.completedAt = new Date();

    // When a visit is completed, append an entry to visitHistory
    // We need the current values of chiefComplaint, chamber, tokenNumber, assignedDoctor
    const existing = await Patient.findById(id).exec();
    if (existing) {
      pushUpdate.visitHistory = {
        visitDate: new Date(),
        status,
        chiefComplaint: existing.chiefComplaint,
        chamber: existing.chamber,
        tokenNumber: existing.tokenNumber,
        doctor: existing.assignedDoctor
      };
    }
  }

  const updateQuery = { $set: update };
  if (Object.keys(pushUpdate).length > 0) {
    updateQuery.$push = pushUpdate;
  }

  const patient = await Patient.findByIdAndUpdate(
    id,
    updateQuery,
    { new: true }
  ).exec();

  return patient;
}

async function update(id, data) {
  const patient = await Patient.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true }
  ).exec();

  return patient;
}

async function getPatientWithHistory(id) {
  return Patient.findById(id)
    .populate('visitHistory.doctor', 'name cid')
    .exec();
}

module.exports = {
  Patient,
  createPatient,
  create: createPatient,
  findByCid,
  findById,
  findAllByStatus,
  getNextQueueNumber,
  getNextTokenForChamber,
  findAll,
  updateStatus,
  update,
  getPatientWithHistory
}
