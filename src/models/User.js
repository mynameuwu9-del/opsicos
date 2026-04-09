const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  nickname: { type: String, default: '', trim: true },
  oauthProvider: String,
  oauthId: String,
  avatar: String,
  plan: { type: String, default: 'free' },
  planExpiresAt: { type: Date },
  monthlyUploadCount: { type: Number, default: 0 },
  lastUploadDate: { type: Date },
  dailyWatchCount: { type: Number, default: 0 },
  lastWatchDate: { type: Date },
  ip: String,
  device: String,
  banned: { type: Boolean, default: false },
  favorites: [String],
  watchHistory: [{ videoId: String, watchedAt: Date }],
  isAdmin: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now },
  discordAccessToken: String, // Store Discord access token for server joining
  language: { type: String, default: 'english' } // User's preferred UI language
});

// Add a method to check and reset the daily watch count
userSchema.methods.checkAndResetWatchCount = async function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If the last watch was before today, reset the count
    if (!this.lastWatchDate || this.lastWatchDate < today) {
        this.dailyWatchCount = 0;
        this.lastWatchDate = today;
    }
};

module.exports = mongoose.model('User', userSchema); 