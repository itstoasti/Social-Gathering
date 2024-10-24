import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import User from '../models/User.js';

const router = express.Router();

// Debug endpoint
router.get('/debug-session', (req, res) => {
  res.json({
    sessionId: req.sessionID,
    session: req.session,
    cookies: req.cookies
  });
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

    console.log('Found user:', user.email);
    return res.json({
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
  } catch (error) {
    console.error('Get accounts status error:', error);
    res.status(500).json({ message: 'Failed to get accounts status' });
  }
});

// Check auth status
router.get('/status', (req, res) => {
  console.log('Checking auth status. Session:', req.sessionID);
  res.json({ 
    authenticated: !!req.session.userId,
    sessionId: req.sessionID 
  });
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
        if (err) reject(err);
        else resolve();
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
    console.log('Twitter callback. Session:', req.sessionID);
    const { oauth_token, oauth_verifier } = req.query;
    const { oauth_token_secret } = req.session;

    console.log('OAuth tokens:', {
      oauth_token,
      oauth_verifier,
      session_oauth_token_secret: oauth_token_secret
    });

    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
      throw new Error('Missing OAuth tokens');
    }

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token as string,
      accessSecret: oauth_token_secret
    });

    const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier as string);
    console.log('Twitter login successful:', screenName);

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

    // Save session before redirect
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('User saved and session updated');
    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

export default router;
