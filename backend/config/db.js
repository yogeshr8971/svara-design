import mongoose from 'mongoose';
import dns from 'dns';

// Fix Node.js Windows SRV query ECONNREFUSED bug
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}

// Global cached connection for traditional and serverless reuse
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const MONGO_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip IPv6 query delays
};

export const connectDB = async (retryCount = 0) => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI environment variable is not defined.');
    return null;
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Mongoose will attempt to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection runtime error:', err.message);
    });

    cached.promise = mongoose
      .connect(uri, MONGO_OPTIONS)
      .then((mongooseInstance) => {
        console.log(`✅ MongoDB Connected: ${mongooseInstance.connection.host} (${mongooseInstance.connection.name})`);
        return mongooseInstance;
      })
      .catch(async (err) => {
        cached.promise = null;
        console.error(`❌ MongoDB connection attempt failed: ${err.message}`);
        
        // Retry safely up to 3 times with exponential backoff rather than exiting process
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`🔄 Retrying MongoDB connection in ${delay}ms (attempt ${retryCount + 1}/3)...`);
          await new Promise((res) => setTimeout(res, delay));
          return connectDB(retryCount + 1);
        }
        
        // Do NOT call process.exit(1) - allow app to run and report 503 on readiness checks
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
  }

  return cached.conn;
};

export const isDbConnected = () => {
  return mongoose.connection && mongoose.connection.readyState === 1;
};

export default connectDB;
