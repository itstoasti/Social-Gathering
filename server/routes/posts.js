import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { IgApiClient } from 'instagram-private-api';
import { FacebookAdsApi } from 'facebook-nodejs-business-sdk';
import Post from '../models/Post.js';
import User from '../models/User.js';

const router = express.Router();

// Create a new post
router.post('/', async (req, res) => {
  try {
    const { caption, mediaUrl, platforms, scheduledFor } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const post = new Post({
      user: userId,
      caption,
      mediaUrl,
      platforms,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      status: 'pending'
    });

    await post.save();

    if (!scheduledFor) {
      // Post immediately
      await publishPost(post);
      post.status = 'published';
      await post.save();
    }

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Failed to create post', error: error.message });
  }
});

// Get user's posts
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const posts = await Post.find({ user: userId }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});

async function publishPost(post) {
  const user = await User.findById(post.user);
  if (!user) throw new Error('User not found');

  const errors = [];

  if (post.platforms.twitter && user.socialAccounts.twitter) {
    try {
      await publishToTwitter(post, user.socialAccounts.twitter);
    } catch (error) {
      console.error('Twitter publish error:', error);
      errors.push({ platform: 'twitter', error: error.message });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Publishing failed: ${JSON.stringify(errors)}`);
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
      const mediaId = await client.v1.uploadMedia(post.mediaUrl);
      await client.v2.tweet({
        text: post.caption,
        media: { media_ids: [mediaId] }
      });
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
    });

    for (const post of pendingPosts) {
      try {
        await publishPost(post);
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
