import mongoose from 'mongoose';

const socialAccountSchema = {
  twitter: {
    _id: false,
    type: {
      accessToken: String,
      accessSecret: String,
      username: String
    },
    default: null
  },
  instagram: {
    _id: false,
    type: {
      accessToken: String,
      username: String
    },
    default: null
  },
  facebook: {
    _id: false,
    type: {
      accessToken: String,
      pageId: String,
      pageName: String
    },
    default: null
  }
};

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  socialAccounts: {
    type: socialAccountSchema,
    default: () => ({
      twitter: null,
      instagram: null,
      facebook: null
    })
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('User', userSchema);
