const mongoose = require('mongoose')

const chamberSchema = new mongoose.Schema(
  {
    chamber_number: {
      type: Number,
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

// One unique chamber number
chamberSchema.index({ chamber_number: 1 }, { unique: true })

const Chamber = mongoose.model('Chamber', chamberSchema)

async function createChamber(data) {
  const chamber = new Chamber(data)
  return await chamber.save()
}

async function findAllChambers() {
  return await Chamber.find({}).sort({ chamber_number: 1 }).lean()
}

async function findChamberById(id) {
  return await Chamber.findById(id).lean()
}

async function findChamberByNumber(chamberNumber) {
  return await Chamber.findOne({ chamber_number: chamberNumber }).lean()
}

module.exports = {
  Chamber,
  createChamber,
  findAllChambers,
  findChamberById,
  findChamberByNumber
}
