import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import User from '../../models/User.js';

const router = express.Router();

// Twitter OAuth
router.get('/', async (req, res) => {
  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET
    });

    const callbackUrl = `${process.env.BASE_URL}/api/auth/twitter/callback`;
    console.log('Twitter callback URL:', callbackUrl);
    
    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl, {
      linkMode: 'authorize'
    });

    // Store tokens in session
    req.session.oauth = {
      token: oauth_token,
      token_secret: oauth_token_secret
    };

    // Force session save
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('OAuth tokens stored in session:', {
            sessionID: req.sessionID,
            hasToken: !!oauth_token,
            hasSecret: !!oauth_token_secret
          });
          resolve();
        }
      });
    });

    res.json({ url });
  } catch (error) {
    console.error('Twitter auth error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to initialize Twitter authentication',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Twitter OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { oauth_token, oauth_verifier } = req.query;
    const storedOAuth = req.session?.oauth;

    console.log('Twitter callback received:', {
      hasOAuthToken: !!oauth_token,
      hasVerifier: !!oauth_verifier,
      storedSession: storedOAuth,
      sessionID: req.sessionID
    });

    if (!oauth_token || !oauth_verifier || !storedOAuth?.token_secret) {
      throw new Error('Invalid OAuth session');
    }

    if (oauth_token !== storedOAuth.token) {
      throw new Error('OAuth token mismatch');
    }

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token,
      accessSecret: storedOAuth.token_secret
    });

    const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier);

    // Clear OAuth tokens from session
    delete req.session.oauth;

    // Create or update user
    let user = await User.findOne({ 'socialAccounts.twitter.username': screenName });
    
    if (!user) {
      user = new User({
