import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize server
const startServer = async () => {
  try {
    await connectDB();

    // Basic middleware
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Trust proxy for secure cookies in production
    if (process.env.NODE_ENV === 'production') {
      app.set('trust proxy', 1);
    }

    // CORS configuration - MUST come before other middleware
    app.use(cors({
      origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL]
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposedHeaders: ['Set-Cookie']
    }));

    // Session store setup
    const sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 24 * 3600,
      crypto: {
        secret: process.env.SESSION_SECRET
      }
    });

    // Session middleware
    app.use(session({
      secret: process.env.SESSION_SECRET,
      name: 'social.sid',
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      }
    }));

    // Add headers middleware
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : 'http://localhost:5173');
      next();
    });

    // Session debugging middleware
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      console.log('Session ID:', req.sessionID);
      console.log('Session Data:', req.session);
      console.log('Cookies:', req.headers.cookie);
      next();
    });

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/posts', postRoutes);

    // Health check
    app.get('/api/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        sessionID: req.sessionID
      });
    });

    // Error handling
    app.use((err, req, res, next) => {
      console.error('Server Error:', err);
      res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`Backend URL: ${process.env.BASE_URL}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
