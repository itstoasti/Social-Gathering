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

// First connect to MongoDB
await connectDB();

// Then set up the session store
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/social-crosspost',
  ttl: 24 * 60 * 60,
  touchAfter: 24 * 3600
});

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    domain: process.env.NODE_ENV === 'production' ? '.render.com' : 'localhost'
  },
  name: 'social.sid'
}));

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    sessionID: req.sessionID,
    cookies: req.cookies,
    session: req.session,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer
    }
  });
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
