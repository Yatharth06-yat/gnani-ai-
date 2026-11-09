const mongoose = require('mongoose');

// Disable query buffering when disconnected to prevent request hangs
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.log('ℹ️ MONGODB_URI not configured. Operating in high-performance memory store mode.');
      return;
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    console.log('Continuing without database - using demo and memory store.');
  }
};

module.exports = connectDB;