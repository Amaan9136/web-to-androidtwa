#!/usr/bin/env node
'use strict';
/**
 * Post-build sanity checks:
 *  - Confirms the AAB/APK is signed
 *  - Confirms targetSdkVersion meets current Play Store requirements
 *  - Reminds you to check assetlinks.json (Digital Asset Links) is live,
 *    since a mismatched fingerprint is the #1 cause of TWAs falling back
 *    to a browser address bar instead of running fullscreen.
 *
 * Usage: node scripts/verify.js --profile seeze
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('../lib/args');
const { loadProfile } = require('../lib/profile');
const { log, ok, warn, fail, tryRun } = require('../lib/shell');

const REQUIRED_MIN_TARGET_SDK = 36; // Update as Play Store policy advances.

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profileName = args.profile || args._[0];
  const profile = loadProfile(profileName);

  const gradlePath = path.join(profile._outputDir, 'app', 'build.gradle');
  const aabPath = path.join(profile._outputDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');

  console.log('');
  log(`Verifying profile "${profile._name}"`);

  // 1. targetSdkVersion check
  if (fs.existsSync(gradlePath)) {
    const content = fs.readFileSync(gradlePath, 'utf8');
    const match = content.match(/targetSdk(?:Version)?\s*[=\s]\s*(\d+)/);
    if (match) {
      const sdk = Number(match[1]);
      if (sdk >= REQUIRED_MIN_TARGET_SDK) {
        ok(`targetSdkVersion ${sdk} meets current Play Store minimum (${REQUIRED_MIN_TARGET_SDK}).`);
      } else {
        fail(`targetSdkVersion ${sdk} is BELOW the required minimum (${REQUIRED_MIN_TARGET_SDK}). Run: npm run patch -- --profile ${profile._name}`);
      }
    } else {
      warn('Could not find targetSdkVersion in build.gradle — inspect manually.');
    }
  } else {
    warn(`build.gradle not found — project not yet scaffolded. Run: npm run build -- --profile ${profile._name}`);
  }

  // 2. Signature check
  if (fs.existsSync(aabPath)) {
    log('Checking AAB signature with jarsigner -verify...');
    const res = tryRun('jarsigner', ['-verify', '-verbose', aabPath]);
    if (res.status === 0) {
      ok('AAB is signed and verifies correctly.');
    } else {
      warn('AAB does not appear to be signed yet. Run: npm run sign -- --profile ' + profile._name);
    }
  } else {
    warn(`No AAB found at ${aabPath} yet — run the build first.`);
  }

  // 3. Digital Asset Links reminder
  console.log('');
  log('Digital Asset Links check (manual step):');
  console.log(`   Your site must serve https://${profile.host}/.well-known/assetlinks.json`);
  console.log('   containing the SHA-256 fingerprint of the SAME keystore used to sign this build.');
  console.log('   Get the fingerprint with:');
  console.log(`     keytool -list -v -keystore "${profile._keystorePath}" -alias "${profile.signingKey.alias}"`);
  console.log('   If it does not match, the app opens with a visible browser URL bar instead of fullscreen.');
  console.log('');
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
