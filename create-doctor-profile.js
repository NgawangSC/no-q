// create-doctor-profile.js
// Usage:
// 1. Set staffCid, specializationName, and chamberNumber below.
// 2. Ensure MONGODB_URI is set in your .env file.
// 3. Run: npm run create-doctor-profile

require('dotenv').config()
const { connectDB, mongoose } = require('./config/mongo')
const { Staff } = require('./models/mongo/Staff')
const {
  createDoctorProfile,
  findDoctorProfileByStaffId
} = require('./models/mongo/DoctorProfile')
const {
  findSpecializationByName
} = require('./models/mongo/Specialization')
const { findChamberByNumber } = require('./models/mongo/Chamber')

// TODO: Set these values before running the script.
const staffCid = 'DOCTOR_CID_HERE' // e.g. '12230011'
const specializationName = 'SPECIALIZATION_NAME_HERE' // e.g. 'Cardiology'
const chamberNumber = 1 // e.g. 101

async function run() {
  let exitCode = 0

  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not set in environment. Aborting.')
      exitCode = 1
      return
    }

    console.log('Connecting to MongoDB...')
    await connectDB()

    console.log(`Finding staff by CID: ${staffCid}...`)
    const staff = await Staff.findOne({ cid: staffCid }).lean()

    if (!staff) {
      console.error(`No Staff found with CID: ${staffCid}`)
      exitCode = 1
      return
    }

    if (staff.role !== 'doctor') {
      console.warn(
        `Warning: Staff with CID ${staffCid} has role '${staff.role}', not 'doctor'. Proceeding anyway.`
      )
    }

    console.log(`Finding specialization by name: ${specializationName}...`)
    const specialization = await findSpecializationByName(specializationName)

    if (!specialization) {
      console.error(
        `No Specialization found with name: '${specializationName}'. Make sure the name matches exactly.`
      )
      exitCode = 1
      return
    }

    console.log(`Finding chamber by number: ${chamberNumber}...`)
    const chamber = await findChamberByNumber(chamberNumber)

    if (!chamber) {
      console.error(`No Chamber found with chamber_number: ${chamberNumber}`)
      exitCode = 1
      return
    }

    console.log('Checking for existing DoctorProfile...')
    const existingProfile = await findDoctorProfileByStaffId(staff._id)

    if (existingProfile) {
      console.log(
        `DoctorProfile already exists for staff CID ${staff.cid} (staff_id: ${staff._id.toString()}, profile_id: ${existingProfile._id.toString()})`
      )
      exitCode = 0
      return
    }

    console.log('Creating new DoctorProfile...')
    const profile = await createDoctorProfile({
      staff_id: staff._id,
      specialization_id: specialization._id,
      chamber_id: chamber._id
    })

    console.log('DoctorProfile created:')
    console.log({
      _id: profile._id.toString(),
      staff_id: profile.staff_id.toString(),
      specialization_id: profile.specialization_id.toString(),
      chamber_id: profile.chamber_id.toString()
    })
  } catch (err) {
    console.error('Error while creating DoctorProfile:')
    console.error(err.stack || err)
    exitCode = 1
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close()
        console.log('MongoDB connection closed')
      }
    } catch (closeErr) {
      console.error('Error while closing MongoDB connection:', closeErr)
      // If we were otherwise successful, treat close error as failure
      if (exitCode === 0) exitCode = 1
    }

    process.exit(exitCode)
  }
}

run()
