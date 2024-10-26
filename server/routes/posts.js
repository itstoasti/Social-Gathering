import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import Post from '../models/Post.js';
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

// Create a new post
router.post('/', asyncHandler(async (req, res) => {
  console.log('Creating post:', {
    body: req.body,
    session: {
      id: req.sessionID,
      userId: req.session.userId
    }
  });

  const { caption, mediaUrl, platforms, scheduledFor } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (!caption && !mediaUrl) {
    return res.status(400).json({ message: 'Please provide either caption or media' });
  }

  if (!platforms || !Object.values(platforms).some(Boolean)) {
    return res.status(400).json({ message: 'Please select at least one platform' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Validate Twitter credentials before proceeding
  if (platforms.twitter) {
    if (!user.socialAccounts?.twitter?.accessToken || !user.socialAccounts?.twitter?.accessSecret) {
      return res.status(400).json({ message: 'Twitter account not properly connected. Please reconnect your account.' });
    }

    try {
      // Verify Twitter credentials
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: user.socialAccounts.twitter.accessToken,
        accessSecret: user.socialAccounts.twitter.accessSecret
      });

      // Test the credentials by getting user info
      await client.v2.me();
    } catch (error) {
      console.error('Twitter credentials validation failed:', error);
      
      // If credentials are invalid, clear them and ask user to reconnect
      user.socialAccounts.twitter = undefined;
      await user.save();
      
      return res.status(401).json({ 
        message: 'Twitter authentication expired. Please reconnect your account.',
        code: 'TWITTER_AUTH_EXPIRED'
      });
    }
  }

  // Create post document
  const post = new Post({
    user: userId,
    caption,
    mediaUrl,
    platforms,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    status: 'pending'
  });

  await post.save();
  console.log('Post saved:', post._id);

  // If no scheduling, post immediately
  if (!scheduledFor) {
    try {
      await publishPost(post, user);
      post.status = 'published';
      await post.save();
    } catch (error) {
      console.error('Failed to publish post:', error);
      post.status = 'failed';
      await post.save();
      throw error;
    }
  }

  res.status(201).json(post);
}));

// Get user's posts
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const posts = await Post.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(posts);
}));

async function publishPost(post, user) {
  const errors = [];

  if (post.platforms.twitter && user.socialAccounts?.twitter?.accessToken) {
    try {
      await publishToTwitter(post, user.socialAccounts.twitter);
    } catch (error) {
      console.error('Twitter publishing error:', error);
      
      // Check if it's an auth error
      if (error.code === 401 || error.code === 403) {
        throw new Error('Twitter authentication expired. Please reconnect your account.');
      }
      
      errors.push({
        platform: 'twitter',
        error: error.message,
        code: error.code
      });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Publishing failed: ${JSON.stringify(errors)}`);
  }
}

async function publishToTwitter(post, twitterAccount) {
  console.log('Publishing to Twitter:', {
    hasCaption: !!post.caption,
    hasMedia: !!post.mediaUrl,
    username: twitterAccount.username
  });

  if (!twitterAccount.accessToken || !twitterAccount.accessSecret) {
    throw new Error('Twitter credentials missing');
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: twitterAccount.accessToken,
    accessSecret: twitterAccount.accessSecret
  });

  try {
    // Verify credentials first
    await client.v2.me();

    if (post.mediaUrl) {
      // For base64 images
      if (post.mediaUrl.startsWith('data:')) {
        const base64Data = post.mediaUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
        await client.v2.tweet({
          text: post.caption || '',
          media: { media_ids: [mediaId] }
        });
      } else {
        // For regular URLs
        const mediaId = await client.v1.uploadMedia(post.mediaUrl);
        await client.v2.tweet({
          text: post.caption || '',
          media: { media_ids: [mediaId] }
        });
      }
    } else {
      await client.v2.tweet(post.caption);
    }

    console.log('Successfully published to Twitter');
  } catch (error) {
    console.error('Twitter API error:', error);
    
    // Enhanced error handling
    if (error.code === 401 || error.code === 403) {
      throw new Error('Twitter authentication expired. Please reconnect your account.');
    } else if (error.code === 429) {
      throw new Error('Twitter rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`Twitter API error: ${error.message}`);
    }
  }
}

// Scheduled posts worker
setInterval(async () => {
  try {
    const now = new Date();
    const pendingPosts = await Post.find({
      status: 'pending',
      scheduledFor: { $lte: now }
    }).populate('user');

    for (const post of pendingPosts) {
      try {
        await publishPost(post, post.user);
        post.status = 'published';
        await post.save();
      } catch (error) {
        console.error(`Failed to publish scheduled post ${post._id}:`, error);
        post.status = 'failed';
        await post.save();
      }
    }
  } catch (error) {
    console.error('Scheduled posts worker error:', error);
  }
}, 60000); // Check every minute

export default router;
