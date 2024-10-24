import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import Post from '../models/Post.js';
import User from '../models/User.js';

const router = express.Router();

// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create a new post
router.post('/', asyncHandler(async (req, res) => {
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

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create post document
    const post = new Post({
      user: userId,
      caption,
      mediaUrl,
      platforms,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      status: scheduledFor ? 'pending' : 'publishing'
    });

    await post.save();

    // If no scheduling, post immediately
    if (!scheduledFor) {
      await publishPost(post, user);
    }

    res.status(201).json(post);
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ 
      message: 'Failed to create post',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
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

  try {
    if (post.platforms.twitter && user.socialAccounts?.twitter?.accessToken) {
      await publishToTwitter(post, user.socialAccounts.twitter);
    }

    // Update post status
    post.status = errors.length > 0 ? 'failed' : 'published';
    await post.save();

    if (errors.length > 0) {
      throw new Error(`Publishing failed: ${JSON.stringify(errors)}`);
    }
  } catch (error) {
    console.error('Post publishing error:', error);
    post.status = 'failed';
    await post.save();
    throw error;
  }
}

async function publishToTwitter(post, twitterAccount) {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: twitterAccount.accessToken,
    accessSecret: twitterAccount.accessSecret
  });

  try {
    if (post.mediaUrl) {
      // For base64 images
      if (post.mediaUrl.startsWith('data:')) {
        const base64Data = post.mediaUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
        await client.v2.tweet({
          text: post.caption,
          media: { media_ids: [mediaId] }
        });
      } else {
        // For regular URLs
        const mediaId = await client.v1.uploadMedia(post.mediaUrl);
        await client.v2.tweet({
          text: post.caption,
          media: { media_ids: [mediaId] }
        });
      }
    } else {
      await client.v2.tweet(post.caption);
    }
  } catch (error) {
    console.error('Twitter API error:', error);
    throw new Error(`Twitter API error: ${error.message}`);
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
