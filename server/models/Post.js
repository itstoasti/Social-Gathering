import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    required: true
  },
  mediaUrl: String,
  platforms: {
    twitter: Boolean,
    instagram: Boolean,
    facebook: Boolean
  },
  scheduledFor: Date,
  status: {
    type: String,
    enum: ['pending', 'published', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Post', postSchema);