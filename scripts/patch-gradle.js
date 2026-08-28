#!/usr/bin/env node
'use strict';
/**
 * Defensive patch: the published @bubblewrap/core@1.25.0 template already
 * ships targetSdkVersion 36, but this script exists as a safety net in case
 * a future/older version of the dependency regresses, or you're patching a
 * project generated elsewhere (e.g. via pwabuilder.com or an older Bubblewrap
 * install). It's idempotent and safe to run multiple times.
 *
 * Usage: node scripts/patch-gradle.js --profile seeze [--target 36] [--min 24]
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('../lib/args');
const { loadProfile } = require('../lib/profile');
const { log, ok, warn, fail } = require('../lib/shell');

const args = parseArgs(process.argv.slice(2));
const targetSdk = args.target ? Number(args.target) : 36;
const minSdkOverride = args.min ? Number(args.min) : null;

function patchFile(profile) {
  const gradlePath = path.join(profile._outputDir, 'app', 'build.gradle');
  if (!fs.existsSync(gradlePath)) {
    fail(`build.gradle not found at ${gradlePath}. Run "npm run build -- --profile ${profile._name}" first.`);
    process.exit(1);
  }

  let content = fs.readFileSync(gradlePath, 'utf8');
  const original = content;

  content = content.replace(
    /targetSdkVersion\s+\d+/g,
    `targetSdkVersion ${targetSdk}`
  );
  content = content.replace(
    /targetSdk\s*=\s*\d+/g,
    `targetSdk = ${targetSdk}`
  );

  if (minSdkOverride !== null) {
    content = content.replace(/minSdkVersion\s+\d+/g, `minSdkVersion ${minSdkOverride}`);
    content = content.replace(/minSdk\s*=\s*\d+/g, `minSdk = ${minSdkOverride}`);
  }

  if (content === original) {
    ok(`build.gradle already targets SDK ${targetSdk} (or pattern not found — verify manually if unsure).`);
  } else {
    fs.writeFileSync(gradlePath, content, 'utf8');
    ok(`Patched ${gradlePath} → targetSdkVersion ${targetSdk}${minSdkOverride ? `, minSdkVersion ${minSdkOverride}` : ''}`);
  }

  // Sanity print of resulting SDK lines
  const finalContent = fs.readFileSync(gradlePath, 'utf8');
  const sdkLines = finalContent.split('\n').filter((l) => /sdk(Version)?\s*[=\s]\s*\d+/i.test(l));
  log('Current SDK version lines in build.gradle:');
  sdkLines.forEach((l) => console.log('   ' + l.trim()));
}

const profileName = args.profile || args._[0];
const profile = loadProfile(profileName);
patchFile(profile);
