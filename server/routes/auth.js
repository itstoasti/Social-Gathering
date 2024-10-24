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
  console.log('Generating Twitter auth URL with callback:', callbackUrl);

  const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl);

  // Store tokens in session
  req.session.oauth_token = oauth_token;
  req.session.oauth_token_secret = oauth_token_secret;

  // Force session save and wait for completion
  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('Failed to save session:', err);
        reject(new Error('Failed to initialize authentication'));
      } else {
        console.log('Session saved successfully:', {
          id: req.sessionID,
          hasToken: !!oauth_token,
          hasSecret: !!oauth_token_secret
        });
        resolve();
      }
    });
  });

  res.json({ url });
}));

// Twitter OAuth callback
router.get('/twitter/callback', asyncHandler(async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const { oauth_token_secret } = req.session;

  console.log('Twitter callback received:', {
    hasQueryToken: !!oauth_token,
    hasQueryVerifier: !!oauth_verifier,
    hasSessionSecret: !!oauth_token_secret,
    sessionID: req.sessionID,
    session: req.session
  });

  if (!oauth_token || !oauth_verifier) {
    throw new Error('Missing OAuth tokens from Twitter');
  }

  if (!oauth_token_secret) {
    throw new Error('Missing OAuth token secret in session');
  }

  // Verify tokens match
  if (oauth_token !== req.session.oauth_token) {
    throw new Error('OAuth token mismatch');
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: oauth_token,
    accessSecret: oauth_token_secret
  });

  try {
    const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier);
    console.log('Twitter login successful:', { screenName });

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
    console.log('User saved:', user._id);

    // Update session
    req.session.userId = user._id;
    
    // Clear OAuth tokens
    delete req.session.oauth_token;
    delete req.session.oauth_token_secret;

    // Force session save and wait for completion
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
          reject(new Error('Failed to save authentication state'));
        } else {
          console.log('Final session state:', {
            id: req.sessionID,
            userId: req.session.userId,
            cookie: req.session.cookie
          });
          resolve();
        }
      });
    });

    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter login error:', error);
    throw error;
  }
}));

// Debug endpoint
router.get('/debug-session', (req, res) => {
  const sessionInfo = {
    sessionId: req.sessionID,
    hasOAuthToken: !!req.session.oauth_token,
    hasOAuthTokenSecret: !!req.session.oauth_token_secret,
    userId: req.session.userId,
    cookie: req.session.cookie,
    headers: {
      'user-agent': req.headers['user-agent'],
      'cookie': req.headers.cookie,
      'origin': req.headers.origin
    }
  };

  res.json(sessionInfo);
});

// Check auth status
router.get('/status', (req, res) => {
  res.json({
    authenticated: !!req.session.userId,
    sessionId: req.sessionID,
    hasSession: !!req.session
  });
});

// Get connected accounts
router.get('/accounts', asyncHandler(async (req, res) => {
  console.log('Getting accounts status:', {
    sessionID: req.sessionID,
    userId: req.session.userId
  });

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

  // Verify Twitter credentials if connected
  let twitterConnected = false;
  let twitterUsername = null;

  if (user.socialAccounts?.twitter?.accessToken) {
    try {
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: user.socialAccounts.twitter.accessToken,
        accessSecret: user.socialAccounts.twitter.accessSecret
      });

      const { data } = await client.v2.me();
      twitterConnected = true;
      twitterUsername = data.username;
    } catch (error) {
      console.error('Failed to verify Twitter credentials:', error);
      // Clear invalid credentials
      user.socialAccounts.twitter = undefined;
      await user.save();
    }
  }

  res.json({
    twitter: {
      connected: twitterConnected,
      username: twitterUsername
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
