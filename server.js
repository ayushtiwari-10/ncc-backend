// backend/server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';

// Import routes
import applicantsRouter from './src/routes/applicants.js';
import authRouter from './src/routes/auth.js';   // ✅ Added auth route

dotenv.config();

const app = express();

// ================== Middleware ==================
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ================== Routes ==================
app.use('/api/applicants', applicantsRouter);
app.use('/api/auth', authRouter);   // ✅ Mount auth routes

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// ================== Global Error Handler ==================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    message: err.message || 'Internal server error'
  });
});

// ================== MongoDB Connection ==================
const PORT = process.env.PORT || 5000;

// Use Atlas URI directly or from .env file
const MONGO_URI = process.env.MONGO_URI || 
  'mongodb+srv://admin100:oNlbm5AYqLf4a0Rc@cluster0.jotnuwf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
