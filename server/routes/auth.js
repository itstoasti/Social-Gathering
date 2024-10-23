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

    req.session.oauth_token_secret = oauth_token_secret;
    res.json({ url });
  } catch (error) {
    console.error('Twitter auth error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
});

// Instagram OAuth
router.get('/instagram', async (req, res) => {
  try {
    const ig = new IgApiClient();
    ig.state.generateDevice(process.env.IG_USERNAME);
    res.json({
      url: `https://api.instagram.com/oauth/authorize?client_id=${process.env.IG_CLIENT_ID}&redirect_uri=${process.env.IG_REDIRECT_URI}&scope=basic&response_type=code`
    });
  } catch (error) {
    console.error('Instagram auth error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
});

// Facebook OAuth
router.get('/facebook', (req, res) => {
  const authUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${process.env.FB_APP_ID}&redirect_uri=${process.env.FB_REDIRECT_URI}&scope=pages_manage_posts,pages_read_engagement`;
  res.json({ url: authUrl });
});

export default router;