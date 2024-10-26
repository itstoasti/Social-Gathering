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

    // Trust proxy for secure cookies
    app.set('trust proxy', 1);

    // Session store setup
    const mongoStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: parseInt(process.env.SESSION_TTL, 10) || 86400,
      autoRemove: 'native',
      touchAfter: parseInt(process.env.SESSION_TOUCH_AFTER, 10) || 86400,
      crypto: {
        secret: process.env.SESSION_SECRET
      },
      collectionName: 'sessions'
    });

    // Session middleware
    app.use(session({
      name: process.env.SESSION_NAME || 'social.sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: mongoStore,
      proxy: true,
      cookie: {
        secure: process.env.COOKIE_SECURE === 'true',
        httpOnly: true,
        sameSite: process.env.COOKIE_SAME_SITE || 'none',
        domain: process.env.COOKIE_DOMAIN,
        maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10) || 86400000
      }
    }));

    // CORS configuration - Must be after session middleware
    app.use(cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Set-Cookie']
    }));

    // Debug middleware
    app.use((req, res, next) => {
      // Add CORS headers for all responses
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL);

      // Log request details
      console.log('Request:', {
        method: req.method,
        path: req.path,
        sessionID: req.sessionID,
        session: req.session
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
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        sessionID: req.sessionID,
        session: req.session
      });

      res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
      });
    });

    // Handle OPTIONS preflight requests
    app.options('*', cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Set-Cookie']
    }));

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`Base URL: ${process.env.BASE_URL}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
