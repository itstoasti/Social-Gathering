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
    const sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 0,
      stringify: false,
      crypto: {
        secret: process.env.SESSION_SECRET
      }
    });

    // Session configuration
    app.use(session({
      name: 'social.sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      proxy: true,
      cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined,
        maxAge: 24 * 60 * 60 * 1000
      }
    }));

    // CORS configuration
    const corsOptions = {
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      origin: (origin, callback) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'https://social-crosspost-frontend.onrender.com',
          'http://localhost:5173',
          'https://localhost:5173'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn('Blocked by CORS:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      }
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // Debug middleware
    app.use((req, res, next) => {
      console.log('Request Debug:', {
        path: req.path,
        method: req.method,
        origin: req.get('origin'),
        sessionID: req.sessionID,
        userId: req.session?.userId,
        cookies: req.cookies
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
          active: !!req.session,
          cookie: req.session?.cookie
        }
      });
    });

    // Global error handling middleware
    app.use((err, req, res, next) => {
      console.error('Server Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
      });

      res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? {
          stack: err.stack,
          details: err
        } : {
          message: 'An unexpected error occurred'
        }
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      console.log('Frontend URL:', process.env.FRONTEND_URL);
      console.log('Base URL:', process.env.BASE_URL);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

startServer();
