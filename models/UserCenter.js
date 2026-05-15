const mongoose = require('mongoose');

/*
 * Added by @Edward
 *
 * Allows profile photos to be stored as compact image data URLs.
 * The frontend resizes avatars before sending them, so this limit only needs
 * to fit the processed avatar image instead of the original upload file.
 */
const MAX_AVATAR_DATA_URL_LENGTH = 750000;

const profileSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    role: {
      type: String,
      default: 'ShadeSafe User',
      trim: true,
      maxlength: 40,
    },
    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    /*
     * Added by @Edward
     *
     * Stores the user's saved profile photo. The Profile page writes this field
     * through PATCH /api/me/profile after the browser prepares the upload.
     */
    avatarUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: MAX_AVATAR_DATA_URL_LENGTH,
    },
  },
  { _id: false }
);

const preferencesSchema = new mongoose.Schema(
  {
    theme: {
      type: String,
      enum: ['light', 'soft-green', 'dark'],
      default: 'light',
    },
    accentColor: {
      type: String,
      enum: ['green', 'blue', 'orange'],
      default: 'green',
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
      maxlength: 10,
    },
    homeArea: {
      type: String,
      default: 'Vancouver',
      trim: true,
      maxlength: 80,
    },
    heatSensitivity: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal',
    },
    alertsEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const userCenterSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    profile: {
      type: profileSchema,
      default: () => ({}),
    },
    preferences: {
      type: preferencesSchema,
      default: () => ({}),
    },
  },
  { timestamps: true, collection: 'userCenterProfiles' }
);

module.exports = mongoose.models.UserCenter || mongoose.model('UserCenter', userCenterSchema);
