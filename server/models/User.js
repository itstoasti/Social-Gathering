import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  socialAccounts: {
    twitter: {
      accessToken: String,
      refreshToken: String,
      username: String
    },
    instagram: {
      accessToken: String,
      username: String
    },
    facebook: {
      accessToken: String,
      pageId: String,
      pageName: String
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('User', userSchema);