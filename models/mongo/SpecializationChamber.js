const mongoose = require('mongoose')

const specializationChamberSchema = new mongoose.Schema(
  {
    specialization_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Specialization',
      required: true
    },
    chamber_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chamber',
      required: true
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
)

// Prevent duplicate mappings of the same specialization/chamber pair
specializationChamberSchema.index(
  { specialization_id: 1, chamber_id: 1 },
  { unique: true }
)

const SpecializationChamber = mongoose.model('SpecializationChamber', specializationChamberSchema)

async function addMapping(data) {
  const mapping = new SpecializationChamber(data)
  return await mapping.save()
}

async function findChambersForSpecialization(specializationId) {
  const mappings = await SpecializationChamber.find({ specialization_id: specializationId })
    .populate('chamber_id', 'chamber_number')
    .lean()

  // Return only the populated chamber documents
  return mappings
    .map((m) => m.chamber_id)
    .filter(Boolean)
}

async function findSpecializationsForChamber(chamberId) {
  const mappings = await SpecializationChamber.find({ chamber_id: chamberId })
    .populate('specialization_id', 'name')
    .lean()

  return mappings
    .map((m) => m.specialization_id)
    .filter(Boolean)
}

module.exports = {
  SpecializationChamber,
  addMapping,
  findChambersForSpecialization,
  findSpecializationsForChamber
}
