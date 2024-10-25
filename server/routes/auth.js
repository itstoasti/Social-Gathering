import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
import User from '../models/User.js';

const router = express.Router();

// Twitter OAuth
router.get('/twitter', async (req, res) => {
  try {
    console.log('Starting Twitter auth...');
    
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET
    });

    const callbackUrl = `${process.env.BASE_URL}/api/auth/twitter/callback`;
    console.log('Twitter callback URL:', callbackUrl);
    
    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl);

    // Store tokens in session
    req.session.oauth_token = oauth_token;
    req.session.oauth_token_secret = oauth_token_secret;

    // Force session save
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Session saved successfully');
          resolve();
        }
      });
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
    console.log('Twitter callback received:', {
      query: req.query,
      session: {
        id: req.sessionID,
        hasToken: !!req.session?.oauth_token_secret
      }
    });

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
      user.socialAccounts = {
        ...user.socialAccounts,
        twitter: { 
          accessToken, 
          accessSecret, 
          username: screenName 
        }
      };
    }

    await user.save();
    req.session.userId = user._id;

    // Clear OAuth tokens
    delete req.session.oauth_token;
    delete req.session.oauth_token_secret;

    // Force session save
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Session saved successfully');
          resolve();
        }
      });
    });

    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Instagram OAuth
router.get('/instagram', async (req, res) => {
  try {
    console.log('Starting Instagram auth...');
    
    const redirectUri = process.env.IG_REDIRECT_URI;
    console.log('Instagram redirect URI:', redirectUri);
    
    const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${
      process.env.IG_CLIENT_ID
    }&redirect_uri=${
      encodeURIComponent(redirectUri)
    }&scope=user_profile,user_media&response_type=code`;
    
    res.json({ url: instagramAuthUrl });
  } catch (error) {
    console.error('Instagram auth error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Instagram OAuth callback
router.get('/instagram/callback', async (req, res) => {
  try {
    console.log('Instagram callback received:', {
      code: req.query.code ? 'present' : 'missing',
      error: req.query.error,
      errorReason: req.query.error_reason,
      errorDescription: req.query.error_description
    });

    const { code } = req.query;
    const redirectUri = process.env.IG_REDIRECT_URI;

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.instagram.com/oauth/access_token', 
      new URLSearchParams({
        client_id: process.env.IG_CLIENT_ID,
        client_secret: process.env.IG_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code.toString()
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, user_id } = tokenResponse.data;

    // Get long-lived access token
    const longLivedTokenResponse = await axios.get(
      'https://graph.instagram.com/access_token',
      {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: process.env.IG_CLIENT_SECRET,
          access_token
        }
      }
    );

    const longLivedToken = longLivedTokenResponse.data.access_token;

    // Get user info
    const userResponse = await axios.get(
      `https://graph.instagram.com/me`,
      {
        params: {
          fields: 'id,username',
          access_token: longLivedToken
        }
      }
    );

    const { username } = userResponse.data;

    // Create or update user
    let user = await User.findById(req.session.userId);
    if (!user) {
      user = new User({
        email: `${username}@instagram.com`,
        socialAccounts: {
          instagram: { 
            accessToken: longLivedToken, 
            username 
          }
        }
      });
    } else {
      user.socialAccounts = {
        ...user.socialAccounts,
        instagram: { 
          accessToken: longLivedToken, 
          username 
        }
      };
    }

    await user.save();
    req.session.userId = user._id;

    // Force session save
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Session saved successfully');
          resolve();
        }
      });
    });

    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Instagram callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Instagram deauthorization callback
router.post('/instagram/deauthorize', async (req, res) => {
  try {
    const { signed_request } = req.body;
    
    if (!signed_request) {
      throw new Error('No signed request received');
    }

    // TODO: Verify signed request
    // Remove user's Instagram credentials
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Instagram deauthorize error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Instagram data deletion
router.post('/instagram/data-deletion', async (req, res) => {
  try {
    const { signed_request } = req.body;
    
    if (!signed_request) {
      throw new Error('No signed request received');
    }

    // TODO: Verify signed request
    // Delete user's Instagram data
    
    res.status(200).json({
      url: `${process.env.BASE_URL}/api/instagram/data-deletion/status`,
      confirmation_code: 'PENDING'
    });
  } catch (error) {
    console.error('Instagram data deletion error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get connected accounts
router.get('/accounts', async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log('Getting accounts for user:', userId);
    
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
        user.socialAccounts.twitter = null;
        await user.save();
      }
    }

    // Verify Instagram credentials
    let instagramConnected = false;
    let instagramUsername = null;

    if (user.socialAccounts?.instagram?.accessToken) {
      try {
        const response = await axios.get(
          `https://graph.instagram.com/me`,
          {
            params: {
              fields: 'username',
              access_token: user.socialAccounts.instagram.accessToken
            }
          }
        );
        instagramConnected = true;
        instagramUsername = response.data.username;
      } catch (error) {
        console.error('Instagram verification failed:', error);
        user.socialAccounts.instagram = null;
        await user.save();
      }
    }

    res.json({
      twitter: {
        connected: twitterConnected,
        username: twitterUsername
      },
      instagram: {
        connected: instagramConnected,
        username: instagramUsername
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
  console.log('Auth status check:', {
    sessionId: req.sessionID,
    userId: req.session?.userId,
    authenticated: !!req.session?.userId
  });
  
  res.json({
    authenticated: !!req.session?.userId,
    sessionId: req.sessionID
  });
});

export default router;
