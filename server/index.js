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

    // CORS configuration - Must be before session middleware
    app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          'https://social-crosspost-frontend.onrender.com',
          'http://localhost:5173',
          'https://localhost:5173'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['set-cookie']
    }));

    // Session store setup
    const sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 0,
      stringify: false
    });

    // Session configuration
    const sessionConfig = {
      name: 'social.sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      proxy: true,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined,
        maxAge: 24 * 60 * 60 * 1000
      }
    };

    app.use(session(sessionConfig));

    // Debug middleware
    app.use((req, res, next) => {
      console.log('Request:', {
        method: req.method,
        path: req.path,
        origin: req.headers.origin,
        cookies: req.cookies,
        session: {
          id: req.sessionID,
          userId: req.session?.userId
        }
      });

      // Add CORS headers for preflight requests
      if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Allow-Credentials', 'true');
        return res.status(200).send();
      }

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
      console.error('Server Error:', err);
      
      // Handle CORS errors
      if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
          message: 'Origin not allowed',
          error: process.env.NODE_ENV === 'development' ? err.message : {}
        });
      }

      res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
      });
    });

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
