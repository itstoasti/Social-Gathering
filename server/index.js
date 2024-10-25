import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import { connectDB } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables based on NODE_ENV
dotenv.config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize server
const startServer = async () => {
  try {
    console.log('Starting server initialization...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('MongoDB URI:', process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));

    // Connect to MongoDB
    const dbConnection = await connectDB();
    console.log('MongoDB connection established');

    // Basic middleware
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Trust proxy for secure cookies in production
    if (process.env.NODE_ENV === 'production') {
      app.set('trust proxy', 1);
    }

    // Session store setup with enhanced security
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

    console.log('Session store created');

    // Enhanced session configuration
    app.use(session({
      name: 'social.sid',
      secret: process.env.SESSION_SECRET,
      resave: true,
      saveUninitialized: true,
      store: sessionStore,
      proxy: true,
      rolling: true,
      cookie: {
        secure: true, // Always use secure cookies
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      }
    }));

    console.log('Session middleware configured');

    // CORS configuration with credentials
    app.use(cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposedHeaders: ['Set-Cookie']
    }));

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/posts', postRoutes);

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok',
        env: process.env.NODE_ENV,
        mongodb: {
          connected: dbConnection.readyState === 1,
          database: dbConnection.name
        },
        session: {
          id: req.sessionID,
          active: !!req.session
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

    // Set up HTTPS server for development
    if (process.env.NODE_ENV === 'development') {
      const certDir = path.join(__dirname, '..', 'certs');
      
      // Create certs directory if it doesn't exist
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir);
      }

      // Generate self-signed certificate if it doesn't exist
      const keyPath = path.join(certDir, 'key.pem');
      const certPath = path.join(certDir, 'cert.pem');

      if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.log('Generating self-signed certificate...');
        const { execSync } = await import('child_process');
        execSync(`openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`);
      }

      const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };

      https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`HTTPS Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
        console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
        console.log(`API URL: ${process.env.BASE_URL}`);
      });
    } else {
      // In production, we assume HTTPS is handled by the hosting platform
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
        console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
        console.log(`API URL: ${process.env.BASE_URL}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
