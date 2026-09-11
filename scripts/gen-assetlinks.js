#!/usr/bin/env node
'use strict';
/**
 * Prints (and optionally writes) the assetlinks.json your website must host
 * at /.well-known/assetlinks.json for the TWA to run fullscreen without a
 * browser URL bar. Reads the SHA-256 fingerprint straight from the keystore
 * so you can't accidentally paste the wrong one.
 *
 * Usage:
 *   node scripts/gen-assetlinks.js --profile seeze
 *   node scripts/gen-assetlinks.js --profile seeze --write   (writes to output/<profile>/assetlinks.json)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseArgs } = require('../lib/args');
const { loadProfile } = require('../lib/profile');
const { log, ok, warn, fail } = require('../lib/shell');

function getFingerprint(profile) {
  if (!fs.existsSync(profile._keystorePath)) {
    fail(`Keystore not found at ${profile._keystorePath}. Generate it first: npm run sign -- --profile ${profile._name} --generate-key`);
    process.exit(1);
  }
  const ksPass = process.env.WEBTWA_KEYSTORE_PASSWORD;
  const args = ['-list', '-v', '-keystore', profile._keystorePath, '-alias', profile.signingKey.alias];
  if (ksPass) args.push('-storepass', ksPass);

  const res = spawnSync('keytool', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    fail('Failed to read keystore. If WEBTWA_KEYSTORE_PASSWORD is not set, keytool will prompt interactively — rerun in a real terminal.');
    console.error(res.stdout || res.stderr);
    process.exit(1);
  }
  const match = res.stdout.match(/SHA256:\s*([0-9A-Fa-f:]+)/);
  if (!match) {
    fail('Could not parse SHA-256 fingerprint from keytool output.');
    process.exit(1);
  }
  return match[1];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const profileName = args.profile || args._[0];
  const profile = loadProfile(profileName);

  const uploadFingerprint = getFingerprint(profile);

  // IMPORTANT: If Play App Signing is enabled for this app (Play Console ->
  // Protected with Play -> Play Store protection -> Manage Play app signing),
  // Google re-signs your app with its own "App signing key" before real users
  // download it from the Play Store. That fingerprint is DIFFERENT from your
  // local upload keystore's fingerprint (the one derived above via keytool).
  //
  // If assetlinks.json only lists the upload key fingerprint, Digital Asset
  // Link verification will fail on every Play Store-installed copy of the
  // app, and the TWA will silently fall back to a browser tab with the
  // Chrome URL bar visible instead of running fullscreen/standalone.
  //
  // Set profile.playSigningFingerprint (in profiles/<name>.json) to the
  // "SHA-256 certificate fingerprint" shown under App signing key in Play
  // Console, and it will be included here automatically. Accepts either a
  // single string or an array of strings (e.g. upload key, Digital Asset
  // Link fingerprint, classical key), so multiple trusted fingerprints can
  // be listed side by side. Empty strings ("") are ignored. If one of the
  // listed fingerprints already matches the upload key fingerprint derived
  // from the keystore, it's left in place rather than duplicated.
  const rawFingerprints = profile.playSigningFingerprint;
  const extraFingerprints = (Array.isArray(rawFingerprints) ? rawFingerprints : [rawFingerprints])
    .filter((fp) => typeof fp === 'string' && fp.trim() !== '');

  const fingerprints = [];
  const uploadKeyAlreadyListed = extraFingerprints.includes(uploadFingerprint);
  if (uploadKeyAlreadyListed) {
    ok('TWA upload key fingerprint already present in "playSigningFingerprint" — not adding a duplicate.');
  } else {
    fingerprints.push(uploadFingerprint);
  }
  for (const fp of extraFingerprints) {
    if (!fingerprints.includes(fp)) fingerprints.push(fp);
  }

  if (!extraFingerprints.length) {
    warn(
      'No "playSigningFingerprint" set in this profile. If Play App Signing is ' +
      'enabled for this app, the generated assetlinks.json will be INCOMPLETE and ' +
      'the TWA will show the browser URL bar for users who installed from the Play ' +
      'Store. Get the "App signing key certificate" SHA-256 fingerprint from ' +
      'Play Console -> Protected with Play -> Play Store protection -> ' +
      'Manage Play app signing, add it to profiles/' + profile._name + '.json as ' +
      '"playSigningFingerprint", and re-run this script.'
    );
  }

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: profile.packageId,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  const json = JSON.stringify(assetLinks, null, 2);
  console.log('');
  ok(`assetlinks.json for ${profile.host}:`);
  console.log(json);
  console.log('');
  log(`Host this exact content at: https://${profile.host}/.well-known/assetlinks.json`);
  log('Content-Type must be application/json, and it must be served over HTTPS with no redirects.');
  if (extraFingerprints.length) {
    log('Includes both the Play App Signing key fingerprint(s) and your local upload key fingerprint.');
  }

  if (args.write) {
    const outPath = path.join(profile._outputDir, 'assetlinks.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, 'utf8');
    ok(`Also wrote to ${outPath}`);
  }
}

main();