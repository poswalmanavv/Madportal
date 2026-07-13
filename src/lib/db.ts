import mongoose from "mongoose";

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = global as typeof globalThis & {
  mongooseCache?: CachedConnection;
};

const cached = globalWithMongoose.mongooseCache ?? { conn: null, promise: null };
globalWithMongoose.mongooseCache = cached;

export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri, {
      dbName: "mad-club",
      bufferCommands: false
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
