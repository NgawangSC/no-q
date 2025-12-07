const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const staffSchema = new mongoose.Schema(
  {
    cid: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    role: {
      type: String,
      enum: ['admin', 'receptionist', 'doctor'],
      default: 'receptionist'
    },
    password: {
      type: String,
      required: true
    },
    is_active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

// Add indexes
staffSchema.index({ role: 1 })

// Hash password before saving
staffSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const saltRounds = 10
  this.password = await bcrypt.hash(this.password, saltRounds)
  next()
})

// Create the model
const Staff = mongoose.model('Staff', staffSchema)

// Helper functions
async function create(data) {
  const staff = new Staff(data)
  return await staff.save()
}

async function findById(id) {
  return await Staff.findById(id).exec()
}

async function findByUsername(cidNumber) {
  // in this system cidNumber is the login username
  return await Staff.findOne({ cid: cidNumber }).exec()
}

async function findAll() {
  return await Staff.find().sort({ name: 1 }).lean()
}

async function update(id, updates) {
  const staff = await Staff.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true }
  )

  return staff
}

async function softDelete(id) {
  return await Staff.findByIdAndUpdate(
    id,
    { $set: { is_active: false } },
    { new: true }
  )
}

async function permanentDelete(id) {
  return await Staff.findByIdAndDelete(id)
}

async function comparePassword(plain, hashed) {
  return await bcrypt.compare(plain, hashed)
}

module.exports = {
  Staff,
  create,
  findById,
  findByUsername,
  findAll,
  update,
  softDelete,
  permanentDelete,
  comparePassword
}
