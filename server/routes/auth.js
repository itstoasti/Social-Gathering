import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import User from '../models/User.js';

const router = express.Router();

// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Route error:', error);
    
    if (req.path.includes('/callback')) {
      const errorMessage = encodeURIComponent(error.message || 'Authentication failed');
      return res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${errorMessage}`);
    }
    
    res.status(500).json({
      message: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  });
};

// Twitter OAuth
router.get('/twitter', asyncHandler(async (req, res) => {
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    throw new Error('Twitter API credentials are not configured');
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET
  });

  const callbackUrl = `${process.env.BASE_URL}/api/auth/twitter/callback`;
  console.log('Callback URL:', callbackUrl);

  const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl);

  // Create a new session if it doesn't exist
  if (!req.session.initialized) {
    req.session.initialized = true;
    req.session.created = new Date().toISOString();
  }

  // Store OAuth tokens in session
  req.session.oauth = {
    token: oauth_token,
    token_secret: oauth_token_secret,
    timestamp: new Date().toISOString()
  };

  // Force session save
  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('Failed to save session:', err);
        reject(err);
      } else {
        console.log('Session saved successfully:', {
          id: req.sessionID,
          hasToken: !!req.session.oauth?.token,
          hasSecret: !!req.session.oauth?.token_secret
        });
        resolve();
      }
    });
  });

  res.json({ url });
}));

// Twitter OAuth callback
router.get('/twitter/callback', asyncHandler(async (req, res) => {
  console.log('Callback received:', {
    query: req.query,
    sessionID: req.sessionID,
    sessionData: req.session
  });

  const { oauth_token, oauth_verifier } = req.query;
  const oauth_token_secret = req.session?.oauth?.token_secret;

  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    console.error('Missing OAuth data:', {
      hasToken: !!oauth_token,
      hasVerifier: !!oauth_verifier,
      hasSecret: !!oauth_token_secret,
      session: req.session
    });
    throw new Error('Missing OAuth tokens');
  }

  if (oauth_token !== req.session?.oauth?.token) {
    throw new Error('OAuth token mismatch');
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: oauth_token,
    accessSecret: oauth_token_secret
  });

  const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier);
  console.log('Twitter login successful:', screenName);

  // Create or update user
  let user = await User.findById(req.session.userId);
  if (!user) {
    user = new User({
      email: `${screenName}@twitter.com`,
      socialAccounts: {
        twitter: { accessToken, accessSecret, username: screenName }
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
  
  // Update session
  req.session.userId = user._id;
  delete req.session.oauth; // Clear OAuth data

  // Save session before redirect
  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('Failed to save session:', err);
        reject(err);
      } else {
        console.log('Session saved with user:', {
          id: req.sessionID,
          userId: req.session.userId
        });
        resolve();
      }
    });
  });

  res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
}));

// Debug endpoint
router.get('/debug-session', (req, res) => {
  res.json({
    sessionId: req.sessionID,
    hasOAuthTokens: !!req.session?.oauth,
    userId: req.session.userId,
    created: req.session.created,
    cookie: req.session.cookie
  });
});

// Check auth status
router.get('/status', (req, res) => {
  res.json({
    authenticated: !!req.session.userId,
    sessionId: req.sessionID
  });
});

// Get connected accounts
router.get('/accounts', asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.json({
      twitter: { connected: false },
      instagram: { connected: false },
      facebook: { connected: false }
    });
  }

  const user = await User.findById(req.session.userId);
  if (!user) {
    return res.json({
      twitter: { connected: false },
      instagram: { connected: false },
      facebook: { connected: false }
    });
  }

  res.json({
    twitter: {
      connected: !!user.socialAccounts?.twitter?.accessToken,
      username: user.socialAccounts?.twitter?.username
    },
    instagram: {
      connected: !!user.socialAccounts?.instagram?.accessToken,
      username: user.socialAccounts?.instagram?.username
    },
    facebook: {
      connected: !!user.socialAccounts?.facebook?.accessToken,
      pageName: user.socialAccounts?.facebook?.pageName
    }
  });
}));

export default router;
