const mongoose = require('mongoose')

const doctorProfileSchema = new mongoose.Schema(
  {
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      unique: true
    },
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

// One profile per staff
doctorProfileSchema.index({ staff_id: 1 }, { unique: true })

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema)

async function createDoctorProfile(data) {
  const profile = new DoctorProfile(data)
  return await profile.save()
}

async function findDoctorProfileByStaffId(staffId) {
  return await DoctorProfile.findOne({ staff_id: staffId })
    .populate('specialization_id', 'name')
    .populate('chamber_id', 'chamber_number')
    .lean()
}

async function findDoctorProfileById(id) {
  return await DoctorProfile.findById(id)
    .populate('specialization_id', 'name')
    .populate('chamber_id', 'chamber_number')
    .lean()
}

async function findAllDoctorProfiles() {
  return await DoctorProfile.find({})
    .populate('specialization_id', 'name')
    .populate('chamber_id', 'chamber_number')
    .lean()
}

async function updateDoctorProfileByStaffId(staffId, updates) {
  return await DoctorProfile.findOneAndUpdate(
    { staff_id: staffId },
    { $set: updates },
    { new: true }
  )
    .populate('specialization_id', 'name')
    .populate('chamber_id', 'chamber_number')
    .lean()
}

module.exports = {
  DoctorProfile,
  createDoctorProfile,
  findDoctorProfileByStaffId,
  findDoctorProfileById,
  findAllDoctorProfiles,
  updateDoctorProfileByStaffId,
  // aliases expected by routes/doctor.js
  create: createDoctorProfile,
  findByStaffId: findDoctorProfileByStaffId,
  findById: findDoctorProfileById,
  findAll: findAllDoctorProfiles,
  update: updateDoctorProfileByStaffId
}
