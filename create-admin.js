// create-admin.js

// Only load dotenv if not in production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}
const { connectDB, mongoose } = require('./config/mongo')
const { Staff } = require('./models/mongo/Staff')

async function run() {
  try {
    console.log('Connecting to MongoDB...')
    await connectDB()

    const adminData = {
      cid: '12230010',
      name: 'System Admin',
      email: 'admin@gmail.com',
      role: 'admin',
      password: 'Admin@123',
      is_active: true
    }

    const admin = await Staff.create(adminData)

    console.log('Admin created:')
    console.log({
      id: admin._id.toString(),
      cid: admin.cid,
      role: admin.role,
      email: admin.email
    })
  } catch (err) {
    console.error('Error creating admin:', err)
  } finally {
    await mongoose.connection.close()
    console.log('MongoDB connection closed')
  }
}

run()
