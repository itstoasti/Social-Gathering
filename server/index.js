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

// Load environment variables
dotenv.config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
});

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize server
const startServer = async () => {
  try {
    console.log('Starting server initialization...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Frontend URL:', process.env.FRONTEND_URL);
    console.log('Base URL:', process.env.BASE_URL);
    
    // Connect to MongoDB
    const dbConnection = await connectDB();
    console.log('MongoDB connected successfully');

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
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      }
    }));

    // CORS configuration
    const corsOptions = {
      origin: (origin, callback) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'https://social-crosspost-frontend.onrender.com',
          'http://localhost:5173',
          'https://localhost:5173'
        ];
        
        console.log('CORS Request from:', origin);
        console.log('Allowed Origins:', allowedOrigins);
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn('Blocked by CORS:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposedHeaders: ['Set-Cookie']
    };

    // Apply CORS middleware
    app.use(cors(corsOptions));

    // Pre-flight requests
    app.options('*', cors(corsOptions));

    // Debug middleware
    app.use((req, res, next) => {
      console.log('Request:', {
        method: req.method,
        url: req.url,
        origin: req.headers.origin,
        cookie: req.headers.cookie,
        sessionID: req.sessionID
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
        },
        mongodb: {
          connected: dbConnection.readyState === 1,
          database: dbConnection.name
        },
        cors: {
          frontendUrl: process.env.FRONTEND_URL,
          allowedOrigins: corsOptions.origin
        }
      });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Server Error:', err);
      
      // Handle CORS errors specifically
      if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
          message: 'CORS error: Origin not allowed',
          error: process.env.NODE_ENV === 'development' ? err : {}
        });
      }

      res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
      });
    });

    // Start server based on environment
    if (process.env.NODE_ENV === 'development') {
      const certDir = path.join(__dirname, '..', 'certs');
      
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir);
      }

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
