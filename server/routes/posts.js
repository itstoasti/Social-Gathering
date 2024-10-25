import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
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

// Get user's posts
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const posts = await Post.find({ user: userId })
    .sort({ scheduledFor: 1, createdAt: -1 })
    .limit(50);

  res.json(posts);
}));

// Delete a post
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.id;
  
  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const post = await Post.findOne({ _id: postId, user: userId });
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  if (post.status !== 'pending') {
    return res.status(400).json({ message: 'Only pending posts can be deleted' });
  }

  await post.deleteOne();
  res.json({ message: 'Post deleted successfully' });
}));

// Update a scheduled post
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.id;
  const { caption, platforms, scheduledFor } = req.body;
  
  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const post = await Post.findOne({ _id: postId, user: userId });
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  if (post.status !== 'pending') {
    return res.status(400).json({ message: 'Only pending posts can be updated' });
  }

  // Update fields
  if (caption) post.caption = caption;
  if (platforms) post.platforms = platforms;
  if (scheduledFor) post.scheduledFor = new Date(scheduledFor);

  await post.save();
  res.json(post);
}));

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
    status: 'pending'
  });

  await post.save();

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

async function publishPost(post, user) {
  const errors = [];

  if (post.platforms.twitter && user.socialAccounts?.twitter?.accessToken) {
    try {
      await publishToTwitter(post, user.socialAccounts.twitter);
    } catch (error) {
      console.error('Twitter publishing error:', error);
      errors.push({
        platform: 'twitter',
        error: error.message
      });
    }
  }

  if (post.platforms.instagram && user.socialAccounts?.instagram?.accessToken) {
    try {
      await publishToInstagram(post, user.socialAccounts.instagram);
    } catch (error) {
      console.error('Instagram publishing error:', error);
      errors.push({
        platform: 'instagram',
        error: error.message
      });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Publishing failed: ${JSON.stringify(errors)}`);
  }
}

async function publishToTwitter(post, twitterAccount) {
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
    if (post.mediaUrl) {
      if (post.mediaUrl.startsWith('data:')) {
        const base64Data = post.mediaUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
        await client.v2.tweet({
          text: post.caption || '',
          media: { media_ids: [mediaId] }
        });
      } else {
        const mediaId = await client.v1.uploadMedia(post.mediaUrl);
        await client.v2.tweet({
          text: post.caption || '',
          media: { media_ids: [mediaId] }
        });
      }
    } else {
      await client.v2.tweet(post.caption);
    }
  } catch (error) {
    if (error.code === 401 || error.code === 403) {
      throw new Error('Twitter authentication expired. Please reconnect your account.');
    } else if (error.code === 429) {
      throw new Error('Twitter rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`Twitter API error: ${error.message}`);
    }
  }
}

async function publishToInstagram(post, instagramAccount) {
  if (!instagramAccount.accessToken) {
    throw new Error('Instagram credentials missing');
  }

  try {
    const containerResponse = await axios.post(
      `https://graph.instagram.com/me/media`,
      {
        image_url: post.mediaUrl,
        caption: post.caption,
        access_token: instagramAccount.accessToken
      }
    );

    const containerId = containerResponse.data.id;

    await axios.post(
      `https://graph.instagram.com/me/media_publish`,
      {
        creation_id: containerId,
        access_token: instagramAccount.accessToken
      }
    );
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Instagram authentication expired. Please reconnect your account.');
    } else {
      throw new Error(`Instagram API error: ${error.message}`);
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
        console.log(`Successfully published scheduled post ${post._id}`);
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
