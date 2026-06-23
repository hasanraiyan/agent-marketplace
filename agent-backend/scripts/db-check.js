import mongoose from 'mongoose';
import User from '../src/models/User.js';

const mongoURI = 'mongodb://localhost:27017/agent-marketplace';

async function check() {
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');
  const users = await User.find({});
  console.log('Users count:', users.length);
  for (const u of users) {
    console.log('User:', {
      id: u._id,
      name: u.name,
      email: u.email,
      clerkId: u.clerkId,
      profile: u.profile,
    });
  }
  await mongoose.disconnect();
}

check().catch(console.error);
