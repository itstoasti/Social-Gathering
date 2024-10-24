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

    // CORS configuration - MUST come before session middleware
    app.use(cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposedHeaders: ['Set-Cookie']
    }));

    // Session middleware configuration
    app.use(session({
      secret: process.env.SESSION_SECRET,
      name: 'social.sid',
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      proxy: true,
      cookie: {
        secure: true, // Always use secure cookies
        httpOnly: true,
        sameSite: 'none', // Required for cross-site cookies
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
        domain: '.onrender.com' // Allow cookies across subdomains
      }
    }));

    // Debug middleware for development
    if (process.env.NODE_ENV !== 'production') {
      app.use((req, res, next) => {
        console.log('Session:', {
          id: req.sessionID,
          cookie: req.session.cookie,
          oauth: {
            token: !!req.session.oauth_token,
            secret: !!req.session.oauth_token_secret
          }
        });
        next();
      });
    }

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
          active: !!req.session,
          cookie: req.session.cookie
        }
      });
    });

    // Error handling middleware
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
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
