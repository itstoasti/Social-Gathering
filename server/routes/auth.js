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

  // Store tokens in session
  req.session.oauthTokens = {
    token: oauth_token,
    tokenSecret: oauth_token_secret,
    timestamp: Date.now()
  };

  // Force session save before redirect
  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('Failed to save session:', err);
        reject(err);
      } else {
        console.log('Session saved successfully:', {
          id: req.sessionID,
          hasTokens: !!req.session.oauthTokens
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
    hasTokens: !!req.session.oauthTokens
  });

  const { oauth_token, oauth_verifier } = req.query;
  const { oauthTokens } = req.session;

  if (!oauth_token || !oauth_verifier || !oauthTokens?.tokenSecret) {
    console.error('Missing OAuth data:', {
      hasToken: !!oauth_token,
      hasVerifier: !!oauth_verifier,
      hasSecret: !!oauthTokens?.tokenSecret,
      session: req.session
    });
    throw new Error('Missing OAuth tokens');
  }

  if (oauth_token !== oauthTokens.token) {
    throw new Error('OAuth token mismatch');
  }

  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token,
      accessSecret: oauthTokens.tokenSecret
    });

    const { client: loggedClient, accessToken, accessSecret } = await client.login(oauth_verifier);
    const { data: userData } = await loggedClient.v2.me();
    
    console.log('Twitter login successful:', userData.username);

    // Create or update user
    let user = await User.findById(req.session.userId);
    if (!user) {
      user = new User({
        email: `${userData.username}@twitter.com`,
        socialAccounts: {
          twitter: {
            accessToken,
            accessSecret,
            username: userData.username
          }
        }
      });
    } else {
      user.socialAccounts.twitter = {
        accessToken,
        accessSecret,
        username: userData.username
      };
    }

    await user.save();
    
    // Update session
    req.session.userId = user._id;
    delete req.session.oauthTokens; // Clear OAuth tokens

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
  } catch (error) {
    console.error('Twitter login error:', error);
    throw new Error('Failed to authenticate with Twitter');
  }
}));

// Debug endpoint
router.get('/debug-session', (req, res) => {
  res.json({
    sessionId: req.sessionID,
    hasOAuthTokens: !!req.session.oauthTokens,
    userId: req.session.userId,
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
