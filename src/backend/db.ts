import mongoose from "mongoose";

// Overrides any database segment in MONGODB_URI. The seed script uses the same name --
// keep them in sync or the app will read from a different database than you seeded.
export const DB_NAME = "mad-club";

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
    // The rejected promise must be cleared, otherwise a single failed connect (Mongo not
    // up yet, transient DNS) is cached forever and every later request re-awaits the same
    // rejection -- the process never recovers even once the database is healthy again.
    cached.promise = mongoose
      .connect(mongoUri, { dbName: DB_NAME, bufferCommands: false })
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
