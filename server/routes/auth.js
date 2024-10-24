import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import User from '../models/User.js';

const router = express.Router();

// Debug endpoint
router.get('/debug-session', (req, res) => {
  const sessionInfo = {
    sessionID: req.sessionID,
    session: { ...req.session },
    cookies: req.cookies,
    headers: {
      'user-agent': req.headers['user-agent'],
      'cookie': req.headers.cookie,
      'origin': req.headers.origin,
      'referer': req.headers.referer
    }
  };

  // Remove sensitive data
  if (sessionInfo.session.oauth_token_secret) {
    sessionInfo.session.oauth_token_secret = '[REDACTED]';
  }
  
  console.log('Debug session info:', sessionInfo);
  res.json(sessionInfo);
});

// Get connected accounts status
router.get('/accounts', async (req, res) => {
  try {
    console.log('Getting accounts status. Session:', req.sessionID);
    const userId = req.session.userId;
    
    if (!userId) {
      console.log('No user ID in session');
      return res.json({
        twitter: { connected: false },
        instagram: { connected: false },
        facebook: { connected: false }
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found:', userId);
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

    console.log('Returning accounts status:', accounts);
    return res.json(accounts);
  } catch (error) {
    console.error('Get accounts status error:', error);
    res.status(500).json({ message: 'Failed to get accounts status' });
  }
});

// Check auth status
router.get('/status', (req, res) => {
  const status = {
    authenticated: !!req.session.userId,
    sessionId: req.sessionID,
    hasSession: !!req.session,
    sessionData: { ...req.session }
  };

  // Remove sensitive data
  if (status.sessionData.oauth_token_secret) {
    status.sessionData.oauth_token_secret = '[REDACTED]';
  }

  console.log('Auth status:', status);
  res.json(status);
});

// Twitter OAuth
router.get('/twitter', async (req, res) => {
  try {
    console.log('Starting Twitter auth. Session:', req.sessionID);
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET
    });

    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(
      `${process.env.BASE_URL}/api/auth/twitter/callback`
    );

    // Store OAuth tokens in session
    req.session.oauth_token_secret = oauth_token_secret;
    req.session.oauth_token = oauth_token;
    
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

    console.log('Twitter auth URL generated:', url);
    res.json({ url });
  } catch (error) {
    console.error('Twitter auth error:', error);
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
});

// Twitter OAuth callback
router.get('/twitter/callback', async (req, res) => {
  try {
    console.log('Twitter callback received');
    console.log('Query params:', req.query);
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);

    const { oauth_token, oauth_verifier } = req.query;
    const { oauth_token_secret } = req.session;

    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
      console.error('Missing OAuth tokens:', {
        oauth_token: !!oauth_token,
        oauth_verifier: !!oauth_verifier,
        oauth_token_secret: !!oauth_token_secret
      });
      throw new Error('Missing OAuth tokens');
    }

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret
    });

    console.log('Attempting Twitter login...');
    const loginResult = await client.login(oauth_verifier);
    console.log('Twitter login successful:', loginResult.screenName);

    let user = await User.findById(req.session.userId);
    if (!user) {
      console.log('Creating new user for:', loginResult.screenName);
      user = new User({
        email: `${loginResult.screenName}@twitter.com`,
        socialAccounts: {
          twitter: {
            accessToken: loginResult.accessToken,
            accessSecret: loginResult.accessSecret,
            username: loginResult.screenName
          }
        }
      });
    } else {
      console.log('Updating existing user:', user.email);
      user.socialAccounts.twitter = {
        accessToken: loginResult.accessToken,
        accessSecret: loginResult.accessSecret,
        username: loginResult.screenName
      };
    }

    await user.save();
    req.session.userId = user._id;

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

    console.log('Redirecting to frontend...');
    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

export default router;
