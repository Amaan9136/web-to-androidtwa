'use strict';
const fs = require('fs');
const path = require('path');
const PROFILES_DIR = path.join(__dirname, '..', 'profiles');

/**
 * Loads a profile JSON file by name (without .json extension) from /profiles.
 * Every field is validated so mistakes fail loudly instead of producing a
 * broken Android project 20 minutes into a build.
 */
function loadProfile(profileName) {
  if (!profileName) {
    throw new Error(
      'No profile specified. Usage: npm run build -- --profile <name>\n' +
      'Available profiles: ' + listProfiles().join(', ')
    );
  }
  const filePath = path.join(PROFILES_DIR, `${profileName}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Profile "${profileName}" not found at ${filePath}\n` +
      'Available profiles: ' + listProfiles().join(', ')
    );
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  let profile;
  try {
    profile = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Profile "${profileName}" is not valid JSON: ${e.message}`);
  }

  const required = [
    'packageId', 'host', 'name', 'launcherName', 'webManifestUrl',
    'startUrl', 'iconUrl', 'themeColor', 'backgroundColor',
    'signingKey', 'appVersionName', 'appVersionCode', 'minSdkVersion',
  ];
  const missing = required.filter((k) => profile[k] === undefined || profile[k] === null || profile[k] === '');
  if (missing.length) {
    throw new Error(`Profile "${profileName}" is missing required fields: ${missing.join(', ')}`);
  }

  if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(profile.packageId)) {
    throw new Error(
      `Profile "${profileName}": packageId "${profile.packageId}" doesn't look like a valid ` +
      'Android application ID (expected reverse-domain form, e.g. com.example.app.twa)'
    );
  }

  if (!profile.signingKey || !profile.signingKey.path || !profile.signingKey.alias) {
    throw new Error(
      `Profile "${profileName}": signingKey must include { "path": "...", "alias": "..." }`
    );
  }

  profile._name = profileName;
  profile._keystorePath = path.resolve(path.join(PROFILES_DIR, '..'), profile.signingKey.path);
  profile._outputDir = path.join(PROFILES_DIR, '..', 'output', profileName);
  return profile;
}

function listProfiles() {
  if (!fs.existsSync(PROFILES_DIR)) return [];
  return fs.readdirSync(PROFILES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

module.exports = { loadProfile, listProfiles, PROFILES_DIR };
