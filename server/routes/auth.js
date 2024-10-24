import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import User from '../models/User.js';

const router = express.Router();

// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Route error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  });
};

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

// Twitter OAuth
router.get('/twitter', asyncHandler(async (req, res) => {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET
  });

  const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(
    `${process.env.BASE_URL}/api/auth/twitter/callback`
  );

  req.session.oauth_token = oauth_token;
  req.session.oauth_token_secret = oauth_token_secret;
  
  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  res.json({ url });
}));

// Twitter OAuth callback
router.get('/twitter/callback', asyncHandler(async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const { oauth_token_secret } = req.session;

  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    throw new Error('Missing OAuth tokens');
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: oauth_token,
    accessSecret: oauth_token_secret
  });

  const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier);

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

  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
}));

export default router;
