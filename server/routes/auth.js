import express from 'express';
import { asyncHandler } from '../middleware/index.js';
import User from '../models/User.js';
import twitterRoutes from './auth/twitter.js';

const router = express.Router();

// Mount Twitter routes
router.use('/twitter', twitterRoutes);

// Check auth status
router.get('/status', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const authenticated = !!userId;
  
  let user = null;
  if (authenticated) {
    user = await User.findById(userId).select('-socialAccounts.twitter.accessToken -socialAccounts.twitter.accessSecret');
  }

  res.json({
    success: true,
    authenticated,
    sessionId: req.sessionID,
    user: authenticated ? user : null
  });
}));

// Get connected accounts
router.get('/accounts', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    accounts: {
      twitter: {
        connected: !!user.socialAccounts.twitter,
        username: user.socialAccounts.twitter?.username
      },
      instagram: {
        connected: !!user.socialAccounts.instagram,
        username: user.socialAccounts.instagram?.username
      },
      facebook: {
        connected: !!user.socialAccounts.facebook,
        pageName: user.socialAccounts.facebook?.pageName
      }
    }
  });
}));

// Logout
router.post('/logout', asyncHandler(async (req, res) => {
  await new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

export default router;
