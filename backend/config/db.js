import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cockpitai';

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');

    // Ensure indexes on the tasks collection
    const Task = mongoose.model('Task');
    await Task.collection.createIndex({ sessionId: 1 });
    await Task.collection.createIndex({ status: 1 });
    console.log('✅ Task indexes ensured (sessionId, status)');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}
