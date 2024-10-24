import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import User from '../models/User.js';

const router = express.Router();

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

    // Store the oauth_token_secret in session for verification during callback
    req.session.oauth_token_secret = oauth_token_secret;
    
    res.json({ url });
  } catch (error) {
    console.error('Twitter auth error:', error);
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
});

// Twitter OAuth Callback
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
      accessSecret: oauth_token_secret,
    });

    const {
      client: loggedClient,
      accessToken,
      accessSecret,
    } = await client.login(oauth_verifier);

    // Get user info
    const user = await loggedClient.v2.me();

    // Find or create user in database
    let dbUser = await User.findOne({ 'socialAccounts.twitter.username': user.data.username });
    
    if (!dbUser) {
      dbUser = new User({
        email: `${user.data.username}@twitter.com`, // Temporary email
        socialAccounts: {
          twitter: {
            username: user.data.username,
            accessToken,
            accessSecret
          }
        }
      });
    } else {
      dbUser.socialAccounts.twitter = {
        username: user.data.username,
        accessToken,
        accessSecret
      };
    }

    await dbUser.save();
    req.session.userId = dbUser._id;

    // Redirect back to frontend
    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Get connected accounts
router.get('/accounts', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({
        twitter: null,
        instagram: null,
        facebook: null
      });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.json({
        twitter: null,
        instagram: null,
        facebook: null
      });
    }

    res.json({
      twitter: user.socialAccounts.twitter ? {
        username: user.socialAccounts.twitter.username
      } : null,
      instagram: user.socialAccounts.instagram ? {
        username: user.socialAccounts.instagram.username
      } : null,
      facebook: user.socialAccounts.facebook ? {
        pageName: user.socialAccounts.facebook.pageName
      } : null
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ message: 'Failed to fetch connected accounts' });
  }
});

export default router;
