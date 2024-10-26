import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import { connectDB } from './config/db.js';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize server
const startServer = async () => {
  try {
    await connectDB();

    // Basic middleware
    app.use(cookieParser(process.env.SESSION_SECRET));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Trust proxy for secure cookies in production
    if (isProduction) {
      app.set('trust proxy', 1);
    }

    // CORS configuration - MUST come before session middleware
    app.use(cors({
      origin: [FRONTEND_URL],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposedHeaders: ['Set-Cookie']
    }));

    // Pre-flight requests
    app.options('*', cors());

    // Session store setup
    const mongoStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 24 * 60 * 60,
      crypto: {
        secret: process.env.SESSION_SECRET
      },
      collectionName: 'sessions'
    });

    // Session middleware
    app.use(session({
      name: 'social.sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: mongoStore,
      proxy: isProduction,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
        domain: isProduction ? '.onrender.com' : undefined
      }
    }));

    // Add headers middleware
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Origin', FRONTEND_URL);
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cookie');
      next();
    });

    // Debug middleware
    app.use((req, res, next) => {
      console.log('Request:', {
        method: req.method,
        path: req.path,
        cookies: req.cookies,
        session: req.session,
        headers: req.headers
      });
      next();
    });

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/posts', postRoutes);

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok',
        env: process.env.NODE_ENV,
        session: {
          id: req.sessionID,
          active: !!req.session
        }
      });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Server Error:', {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });

      res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
      });
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      console.log(`Frontend URL: ${FRONTEND_URL}`);
      console.log(`Base URL: ${process.env.BASE_URL}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
