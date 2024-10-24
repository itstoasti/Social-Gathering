import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import User from '../models/User.js';

const router = express.Router();

// Get connected accounts status
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
  res.json({ authenticated: !!req.session.userId });
});

// Twitter OAuth
router.get('/twitter', async (req, res) => {
  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET
    });

    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(
      `${process.env.BASE_URL}/api/auth/twitter/callback`
    );

    req.session.oauth_token_secret = oauth_token_secret;
    res.json({ url });
  } catch (error) {
    console.error('Twitter auth error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
});

// Twitter OAuth callback
router.get('/twitter/callback', async (req, res) => {
  try {
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

    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error`);
  }
});

export default router;
