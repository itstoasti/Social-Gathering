import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
import User from '../models/User.js';

const router = express.Router();

// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Auth route error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  });
};

// Twitter OAuth
router.get('/twitter', asyncHandler(async (req, res) => {
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
}));

// Twitter OAuth callback
router.get('/twitter/callback', asyncHandler(async (req, res) => {
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

    // Update session with user ID
    req.session.userId = user._id;

    // Force session save
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('User session saved:', {
            sessionID: req.sessionID,
            userId: user._id
          });
          resolve();
        }
      });
    });

    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
}));

// Instagram OAuth
router.get('/instagram', asyncHandler(async (req, res) => {
  const redirectUri = process.env.IG_REDIRECT_URI;
  const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.IG_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user_profile,user_media&response_type=code`;
  
  res.json({ url: instagramAuthUrl });
}));

// Instagram OAuth callback
router.get('/instagram/callback', asyncHandler(async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.instagram.com/oauth/access_token', {
      client_id: process.env.IG_CLIENT_ID,
      client_secret: process.env.IG_CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: process.env.IG_REDIRECT_URI,
      code
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, user_id } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get(`https://graph.instagram.com/me?fields=id,username&access_token=${access_token}`);
    const { username } = userResponse.data;

    // Create or update user
    let user = await User.findOne({ 'socialAccounts.instagram.username': username });

    if (!user) {
      user = new User({
        email: `${username}@instagram.com`,
        socialAccounts: {
          instagram: {
            accessToken: access_token,
            username
          }
        }
      });
    } else {
      user.socialAccounts.instagram = {
        accessToken: access_token,
        username
      };
    }

    await user.save();

    // Update session
    req.session.userId = user._id;
    await req.session.save();

    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Instagram callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error&message=${encodeURIComponent(error.message)}`);
  }
}));

// Instagram data deletion callback
router.get('/instagram/data-deletion', asyncHandler(async (req, res) => {
  try {
    const { signed_request } = req.query;
    
    if (!signed_request) {
      throw new Error('No signed request received');
    }

    // Verify signed request here...
    
    // Delete user data
    const [userId] = Buffer.from(signed_request.split('.')[0], 'base64').toString().split('.');
    await User.findOneAndUpdate(
      { 'socialAccounts.instagram.id': userId },
      { $unset: { 'socialAccounts.instagram': 1 } }
    );

    res.json({ url: process.env.IG_DATA_DELETION_URL });
  } catch (error) {
    console.error('Instagram data deletion error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to process data deletion request',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}));

// Get connected accounts
router.get('/accounts', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    twitter: {
      connected: !!user.socialAccounts.twitter,
      username: user.socialAccounts.twitter?.username
    },
    instagram: {
      connected: !!user.socialAccounts.instagram,
      username: user.socialAccounts.instagram?.username
    },
    facebook: {
      connected: !!user.socialAccounts.facebook,
      pageName: user.socialAccounts.facebook?.pageName
    }
  });
}));

// Check auth status
router.get('/status', (req, res) => {
  try {
    res.json({
      authenticated: !!req.session.userId,
      sessionId: req.sessionID
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to check authentication status',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      res.status(500).json({ 
        message: 'Failed to logout',
        error: process.env.NODE_ENV === 'development' ? err : undefined
      });
    } else {
      res.json({ message: 'Logged out successfully' });
    }
  });
});

export default router;
