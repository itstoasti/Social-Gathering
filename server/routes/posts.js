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
    const userId = req.session.userId; // Assuming user is authenticated

    const post = new Post({
      user: userId,
      caption,
      mediaUrl,
      platforms,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null
    });

    await post.save();

    if (!scheduledFor) {
      // Post immediately
      await publishPost(post);
    }

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

// Get user's posts
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const posts = await Post.find({ user: userId }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});

async function publishPost(post) {
  const user = await User.findById(post.user);

  if (post.platforms.twitter && user.socialAccounts.twitter) {
    await publishToTwitter(post, user.socialAccounts.twitter);
  }

  if (post.platforms.instagram && user.socialAccounts.instagram) {
    await publishToInstagram(post, user.socialAccounts.instagram);
  }

  if (post.platforms.facebook && user.socialAccounts.facebook) {
    await publishToFacebook(post, user.socialAccounts.facebook);
  }
}

async function publishToTwitter(post, twitterAccount) {
  const client = new TwitterApi({
    accessToken: twitterAccount.accessToken,
    accessSecret: twitterAccount.accessSecret
  });

  if (post.mediaUrl) {
    const mediaId = await client.v1.uploadMedia(post.mediaUrl);
    await client.v2.tweet({
      text: post.caption,
      media: { media_ids: [mediaId] }
    });
  } else {
    await client.v2.tweet(post.caption);
  }
}

async function publishToInstagram(post, instagramAccount) {
  const ig = new IgApiClient();
  ig.state.generateDevice(instagramAccount.username);
  await ig.account.login(instagramAccount.username, instagramAccount.password);

  if (post.mediaUrl) {
    await ig.publish.photo({
      file: post.mediaUrl,
      caption: post.caption
    });
  }
}

async function publishToFacebook(post, facebookAccount) {
  const api = FacebookAdsApi.init(facebookAccount.accessToken);
  const page = new Page(facebookAccount.pageId);

  if (post.mediaUrl) {
    await page.createPhoto({
      message: post.caption,
      url: post.mediaUrl
    });
  } else {
    await page.createFeed({
      message: post.caption
    });
  }
}

export default router;