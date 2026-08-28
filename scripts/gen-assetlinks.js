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

  const fingerprint = getFingerprint(profile);

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: profile.packageId,
        sha256_cert_fingerprints: [fingerprint],
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

  if (args.write) {
    const outPath = path.join(profile._outputDir, 'assetlinks.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, 'utf8');
    ok(`Also wrote to ${outPath}`);
  }
}

main();
