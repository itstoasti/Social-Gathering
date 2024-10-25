import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import User from '../models/User.js';

const router = express.Router();

// Twitter OAuth
router.get('/twitter', async (req, res) => {
  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET
    });

    const callbackUrl = `${process.env.BASE_URL}/api/auth/twitter/callback`;
    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl);

    // Store tokens in session
    req.session.oauth_token = oauth_token;
    req.session.oauth_token_secret = oauth_token_secret;

    // Force session save and wait for completion
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Set cookie headers explicitly
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({ url });
  } catch (error) {
    console.error('Twitter auth error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Twitter OAuth callback
router.get('/twitter/callback', async (req, res) => {
  try {
    const { oauth_token, oauth_verifier } = req.query;
    const { oauth_token_secret } = req.session;

    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
      console.error('Missing OAuth parameters:', {
        hasToken: !!oauth_token,
        hasVerifier: !!oauth_verifier,
        hasSecret: !!oauth_token_secret,
        session: req.session
      });
      throw new Error('Invalid OAuth session state');
    }

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret
    });

    const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier);

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
    req.session.userId = user._id;

    // Clear OAuth tokens
    delete req.session.oauth_token;
    delete req.session.oauth_token_secret;

    // Force session save and wait for completion
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Set cookie headers explicitly
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Set-Cookie': [
        `connect.sid=${req.sessionID}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
      ]
    });

    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Get connected accounts
router.get('/accounts', async (req, res) => {
  try {
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

    // Verify Twitter credentials
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
        console.error('Twitter verification failed:', error);
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
        connected: false
      },
      facebook: {
        connected: false
      }
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Check auth status
router.get('/status', (req, res) => {
  res.json({
    authenticated: !!req.session.userId,
    sessionId: req.sessionID
  });
});

export default router;
