const mongoose = require('mongoose');

// MongoDB connection string from environment variable
const MONGODB_URI = process.env.MONGODB_URI;

// Skip MongoDB connection if URI is not provided
if (!MONGODB_URI) {
  console.warn('MONGODB_URI is not set. MongoDB connection will be skipped.');
  module.exports = { connectDB: () => {}, mongoose };
  return;
}

// Configure Mongoose to use the latest server discovery and monitoring engine
mongoose.set('strictQuery', true);

// Connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('ℹ️  MongoDB disconnected');
});

// Connect to MongoDB
async function connectDB() {
  try {
    console.log("Connecting to MongoDB...");

    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log(`Connected to MongoDB: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}

// Export the connection and mongoose
module.exports = { connectDB, mongoose };
