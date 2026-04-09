const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required. Please set it in your .env file.');
}

/**
 * Establishes a single connection to MongoDB using Mongoose
 * and returns the underlying driver client. This client can then be
 * shared with other libraries like 'connect-mongo'.
 */
async function connectToDatabase() {
  // If we are already connected, return the existing client.
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection.getClient();
  }

  try {
    // Await the Mongoose connection.
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
    
    console.log('Successfully connected to MongoDB.');

    // Return the underlying MongoDB driver client.
    return mongoose.connection.getClient();
  } catch (error) {
    console.error('CRITICAL: Error connecting to MongoDB:', error);
    throw error; // This will stop the server from starting if the DB is down.
  }
}

module.exports = connectToDatabase;
