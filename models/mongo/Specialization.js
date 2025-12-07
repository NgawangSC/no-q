const mongoose = require('mongoose')

const specializationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
)

const Specialization = mongoose.model('Specialization', specializationSchema)

async function createSpecialization(data) {
  const specialization = new Specialization(data)
  return await specialization.save()
}

async function findAllSpecializations() {
  return await Specialization.find({}).sort({ name: 1 }).lean()
}

async function findSpecializationById(id) {
  return await Specialization.findById(id).lean()
}

async function findSpecializationByName(name) {
  return await Specialization.findOne({ name }).lean()
}

module.exports = {
  Specialization,
  createSpecialization,
  findAllSpecializations,
  findSpecializationById,
  findSpecializationByName
}
