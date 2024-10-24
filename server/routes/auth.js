import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import User from '../models/User.js';

const router = express.Router();

// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Route error:', error);
    
    // If it's a callback route, redirect to frontend with error
    if (req.path.includes('/callback')) {
      const errorMessage = encodeURIComponent(error.message || 'Authentication failed');
      return res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${errorMessage}`);
    }
    
    // Otherwise send JSON error response
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

  // Store tokens in session
  req.session.oauth_token = oauth_token;
  req.session.oauth_token_secret = oauth_token_secret;
  
  // Force session save before continuing
  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('Failed to save session:', err);
        reject(err);
      } else {
        console.log('Session saved successfully:', {
          sessionID: req.sessionID,
          hasToken: !!req.session.oauth_token,
          hasSecret: !!req.session.oauth_token_secret
        });
        resolve();
      }
    });
  });

  console.log('Redirecting to Twitter auth URL:', url);
  res.json({ url });
}));

// Twitter OAuth callback
router.get('/twitter/callback', asyncHandler(async (req, res) => {
  console.log('Received callback with query:', req.query);
  console.log('Session state:', {
    id: req.sessionID,
    oauth_token: req.session.oauth_token,
    has_secret: !!req.session.oauth_token_secret
  });

  const { oauth_token, oauth_verifier } = req.query;
  const { oauth_token_secret } = req.session;

  // Validate all required tokens are present
  if (!oauth_token || !oauth_verifier) {
    throw new Error('Missing OAuth tokens in callback request');
  }

  if (!oauth_token_secret) {
    throw new Error('Missing OAuth token secret in session');
  }

  // Verify tokens match
  if (oauth_token !== req.session.oauth_token) {
    throw new Error('OAuth token mismatch');
  }

  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret
    });

    const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier);
    console.log('Twitter login successful for:', screenName);

    // Create or update user
    let user = await User.findById(req.session.userId);
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
    req.session.userId = user._id;

    // Clear OAuth tokens from session
    delete req.session.oauth_token;
    delete req.session.oauth_token_secret;

    // Save session before redirect
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
          reject(err);
        } else {
          console.log('Session saved successfully');
          resolve();
        }
      });
    });

    // Redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    const errorMessage = encodeURIComponent(error.message || 'Authentication failed');
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${errorMessage}`);
  }
}));

// Debug endpoint
router.get('/debug-session', (req, res) => {
  console.log('Session debug:', {
    id: req.sessionID,
    oauth_token: req.session.oauth_token,
    oauth_token_secret: '***hidden***',
    userId: req.session.userId
  });
  
  res.json({
    sessionId: req.sessionID,
    hasOAuthTokens: !!(req.session.oauth_token && req.session.oauth_token_secret),
    userId: req.session.userId
  });
});

// Check auth status
router.get('/status', asyncHandler(async (req, res) => {
  res.json({
    authenticated: !!req.session.userId,
    sessionId: req.sessionID
  });
}));

// Get connected accounts status
router.get('/accounts', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.json({
      twitter: { connected: false },
      instagram: { connected: false },
      facebook: { connected: false }
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.json({
      twitter: { connected: false },
      instagram: { connected: false },
      facebook: { connected: false }
    });
  }

  const accounts = {
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
  };

  res.json(accounts);
}));

export default router;
