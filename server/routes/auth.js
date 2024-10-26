import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
import User from '../models/User.js';

const router = express.Router();

// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Auth route error:', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  });
};

// Check auth status
router.get('/status', (req, res) => {
  try {
    const status = {
      success: true,
      authenticated: !!req.session.userId,
      sessionId: req.sessionID
    };
    
    res.json(status);
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check authentication status'
    });
  }
});

// Twitter OAuth
router.get('/twitter', asyncHandler(async (req, res) => {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET
  });

  const callbackUrl = `${process.env.BASE_URL}/api/auth/twitter/callback`;
  console.log('Twitter callback URL:', callbackUrl);
  
  const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl, {
    linkMode: 'authorize'
  });

  // Store tokens in session
  req.session.oauth = {
    token: oauth_token,
    token_secret: oauth_token_secret
  };

  // Force session save
  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        reject(new Error('Failed to save session'));
      } else {
        console.log('OAuth tokens stored in session:', {
          sessionID: req.sessionID,
          hasToken: !!oauth_token,
          hasSecret: !!oauth_token_secret
        });
        resolve();
      }
    });
  });

  res.json({ success: true, url });
}));

// Twitter OAuth callback
router.get('/twitter/callback', asyncHandler(async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const storedOAuth = req.session?.oauth;

  console.log('Twitter callback received:', {
    hasOAuthToken: !!oauth_token,
    hasVerifier: !!oauth_verifier,
    storedSession: storedOAuth,
    sessionID: req.sessionID
  });

  if (!oauth_token || !oauth_verifier || !storedOAuth?.token_secret) {
    throw new Error('Invalid OAuth session');
  }

  if (oauth_token !== storedOAuth.token) {
    throw new Error('OAuth token mismatch');
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: oauth_token,
    accessSecret: storedOAuth.token_secret
  });

  const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier);

  // Clear OAuth tokens from session
  delete req.session.oauth;

  // Create or update user
  let user = await User.findOne({ 'socialAccounts.twitter.username': screenName });
  
  if (!user) {
    user = new User({
      email: `${screenName}@twitter.com`,
      socialAccounts: {
        twitter: { 
          accessToken, 
          accessSecret, 
          username: screenName 
        }
      }
    });
  } else {
    user.socialAccounts.twitter = {
      accessToken,
      accessSecret,
      username: screenName
    };
  }

  await user.save();

  // Update session with user ID
  req.session.userId = user._id;

  // Force session save
  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        reject(new Error('Failed to save user session'));
      } else {
        console.log('User session saved:', {
          sessionID: req.sessionID,
          userId: user._id
        });
        resolve();
      }
    });
  });

  res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
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
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to logout'
      });
    } else {
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    }
  });
});

export default router;
