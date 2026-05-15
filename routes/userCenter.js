const express = require('express');
const mongoose = require('mongoose');

const UserCenter = require('../models/UserCenter');

const router = express.Router();

const VALID_THEMES = ['light', 'soft-green', 'dark'];
const VALID_ACCENT_COLORS = ['green', 'blue', 'orange'];
const VALID_HEAT_SENSITIVITY = ['low', 'normal', 'high'];
const VALID_LANGUAGES = ['en'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * Added by @Edward
 *
 * Defines what avatar values the Profile page is allowed to save.
 * The frontend sends compact image data URLs, while safe remote/local image
 * URLs are also allowed for future reuse.
 */
const MAX_AVATAR_DATA_URL_LENGTH = 750000;
const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const REMOTE_AVATAR_URL_PATTERN = /^(?:https?:\/\/|\/images\/)[^\s"'<>]+$/i;

function getSessionUsername(req) {
  if (!req.session || !req.session.user || typeof req.session.user.username !== 'string') {
    return '';
  }

  return req.session.user.username.trim();
}

function getAuthUserModel() {
  try {
    return mongoose.model('User');
  } catch (err) {
    return null;
  }
}

async function currentAuthUserExists(username) {
  const User = getAuthUserModel();

  if (!User) {
    return true;
  }

  const authUser = await User.exists({ username });
  return Boolean(authUser);
}

function getDefaultEmail(username) {
  return EMAIL_PATTERN.test(username) ? username.toLowerCase() : '';
}

/*
 * Added by @Edward
 *
 * Validates uploaded avatar values before they are saved to MongoDB.
 * This prevents arbitrary text or unsafe URLs from being stored as avatarUrl.
 */
function isValidAvatarUrl(avatarUrl) {
  if (avatarUrl.length === 0) {
    return true;
  }

  if (avatarUrl.startsWith('data:image/')) {
    return (
      avatarUrl.length <= MAX_AVATAR_DATA_URL_LENGTH &&
      AVATAR_DATA_URL_PATTERN.test(avatarUrl)
    );
  }

  return avatarUrl.length <= 500 && REMOTE_AVATAR_URL_PATTERN.test(avatarUrl);
}

function defaultUserCenter(username) {
  return {
    username,
    email: getDefaultEmail(username),
    profile: {
      displayName: username,
      role: 'ShadeSafe User',
      bio: '',
      /*
       * Added by @Edward
       *
       * Starts each account without a saved avatar. The Profile page fills this
       * after the user chooses and saves a profile photo.
       */
      avatarUrl: '',
    },
    preferences: {
      theme: 'light',
      accentColor: 'green',
      language: 'en',
      homeArea: 'Vancouver',
      heatSensitivity: 'normal',
      alertsEnabled: true,
    },
  };
}

async function getOrCreateUserCenter(username) {
  return UserCenter.findOneAndUpdate(
    { username },
    { $setOnInsert: defaultUserCenter(username) },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function toUserCenterPayload(userCenter) {
  const profile = userCenter.profile || {};
  const preferences = userCenter.preferences || {};

  return {
    username: userCenter.username,
    email: userCenter.email || '',
    profile: {
      displayName: profile.displayName || userCenter.username,
      role: profile.role || 'ShadeSafe User',
      bio: profile.bio || '',
      avatarUrl: profile.avatarUrl || '',
    },
    preferences: {
      theme: preferences.theme || 'light',
      accentColor: preferences.accentColor || 'green',
      language: preferences.language || 'en',
      homeArea: preferences.homeArea || 'Vancouver',
      heatSensitivity: preferences.heatSensitivity || 'normal',
      alertsEnabled:
        typeof preferences.alertsEnabled === 'boolean' ? preferences.alertsEnabled : true,
    },
  };
}

function readOptionalString(body, fieldName, maxLength, errors) {
  if (!Object.prototype.hasOwnProperty.call(body, fieldName)) {
    return undefined;
  }

  const value = body[fieldName];

  if (value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    errors.push(`${fieldName} must be text.`);
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    errors.push(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function readOptionalEnum(body, fieldName, allowedValues, errors) {
  const value = readOptionalString(body, fieldName, 80, errors);

  if (value === undefined) {
    return undefined;
  }

  if (!allowedValues.includes(value)) {
    errors.push(`${fieldName} must be one of: ${allowedValues.join(', ')}.`);
  }

  return value;
}

function readOptionalBoolean(body, fieldName, errors) {
  if (!Object.prototype.hasOwnProperty.call(body, fieldName)) {
    return undefined;
  }

  if (typeof body[fieldName] !== 'boolean') {
    errors.push(`${fieldName} must be true or false.`);
    return undefined;
  }

  return body[fieldName];
}

function validateProfileBody(body) {
  const errors = [];
  const updates = {};

  const displayName = readOptionalString(body, 'displayName', 60, errors);
  const role = readOptionalString(body, 'role', 40, errors);
  const email = readOptionalString(body, 'email', 120, errors);
  const bio = readOptionalString(body, 'bio', 300, errors);

  /*
   * Added by @Edward
   *
   * Reads the optional avatar image sent by the Profile page. The larger max
   * length is needed because the avatar is saved as a compact data URL string.
   */
  const avatarUrl = readOptionalString(body, 'avatarUrl', MAX_AVATAR_DATA_URL_LENGTH, errors);

  if (displayName !== undefined) {
    if (displayName.length === 0) {
      errors.push('displayName cannot be empty.');
    }
    updates.displayName = displayName;
  }

  if (role !== undefined) {
    updates.role = role;
  }

  if (email !== undefined) {
    if (email.length > 0 && !EMAIL_PATTERN.test(email)) {
      errors.push('email must be a valid email address.');
    }
    updates.email = email;
  }

  if (bio !== undefined) {
    updates.bio = bio;
  }

  if (avatarUrl !== undefined) {
    if (!isValidAvatarUrl(avatarUrl)) {
      errors.push('avatarUrl must be an image data URL or safe image URL.');
    }
    updates.avatarUrl = avatarUrl;
  }

  return { errors, updates };
}

function validateSettingsBody(body) {
  const errors = [];
  const updates = {};

  const theme = readOptionalEnum(body, 'theme', VALID_THEMES, errors);
  const accentColor = readOptionalEnum(body, 'accentColor', VALID_ACCENT_COLORS, errors);
  const language = readOptionalEnum(body, 'language', VALID_LANGUAGES, errors);
  const homeArea = readOptionalString(body, 'homeArea', 80, errors);
  const heatSensitivity = readOptionalEnum(body, 'heatSensitivity', VALID_HEAT_SENSITIVITY, errors);
  const alertsEnabled = readOptionalBoolean(body, 'alertsEnabled', errors);

  if (theme !== undefined) {
    updates.theme = theme;
  }

  if (accentColor !== undefined) {
    updates.accentColor = accentColor;
  }

  if (language !== undefined) {
    updates.language = language;
  }

  if (homeArea !== undefined) {
    updates.homeArea = homeArea;
  }

  if (heatSensitivity !== undefined) {
    updates.heatSensitivity = heatSensitivity;
  }

  if (alertsEnabled !== undefined) {
    updates.alertsEnabled = alertsEnabled;
  }

  return { errors, updates };
}

async function loadCurrentUserCenter(req, res) {
  const username = getSessionUsername(req);

  if (!username) {
    res.status(401).json({ message: 'Please log in first.' });
    return null;
  }

  const authUserExists = await currentAuthUserExists(username);

  if (!authUserExists) {
    res.status(404).json({ message: 'Current user was not found.' });
    return null;
  }

  return getOrCreateUserCenter(username);
}

router.get('/', async (req, res) => {
  try {
    const userCenter = await loadCurrentUserCenter(req, res);

    if (!userCenter) {
      return;
    }

    res.json(toUserCenterPayload(userCenter));
  } catch (err) {
    console.error('Error loading user center profile:', err);
    res.status(500).json({ message: 'Failed to load user profile.' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const { errors, updates } = validateProfileBody(req.body || {});

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Invalid profile data.', errors });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No profile fields were provided.' });
    }

    const userCenter = await loadCurrentUserCenter(req, res);

    if (!userCenter) {
      return;
    }

    if (updates.email !== undefined) {
      userCenter.email = updates.email;
    }

    userCenter.profile = userCenter.profile || {};

    /*
     * Added by @Edward
     *
     * Saves editable Profile page fields, including avatarUrl, into the
     * userCenterProfiles document for the current logged-in user.
     */
    ['displayName', 'role', 'bio', 'avatarUrl'].forEach((fieldName) => {
      if (updates[fieldName] !== undefined) {
        userCenter.profile[fieldName] = updates[fieldName];
      }
    });

    await userCenter.save();

    res.json(toUserCenterPayload(userCenter));
  } catch (err) {
    console.error('Error updating user center profile:', err);
    res.status(500).json({ message: 'Failed to update user profile.' });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const { errors, updates } = validateSettingsBody(req.body || {});

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Invalid settings data.', errors });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No settings fields were provided.' });
    }

    const userCenter = await loadCurrentUserCenter(req, res);

    if (!userCenter) {
      return;
    }

    userCenter.preferences = userCenter.preferences || {};

    Object.keys(updates).forEach((fieldName) => {
      userCenter.preferences[fieldName] = updates[fieldName];
    });

    await userCenter.save();

    res.json(toUserCenterPayload(userCenter));
  } catch (err) {
    console.error('Error updating user center settings:', err);
    res.status(500).json({ message: 'Failed to update user settings.' });
  }
});

module.exports = router;
