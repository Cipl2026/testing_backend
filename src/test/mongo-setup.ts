import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

export async function clearDatabase() {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db?.collections();
  if (!collections) return;
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

beforeAll(async () => {
  const { connectDatabase } = await import('@/config/database.js');
  await connectDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  const { disconnectDatabase } = await import('@/config/database.js');
  await disconnectDatabase();
});
