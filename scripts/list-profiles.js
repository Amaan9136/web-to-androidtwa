#!/usr/bin/env node
'use strict';
const { listProfiles, loadProfile } = require('../lib/profile');
const { log, ok, warn } = require('../lib/shell');

const names = listProfiles();
if (!names.length) {
  warn('No profiles found in /profiles. Copy profiles/example.json to profiles/<yoursite>.json to get started.');
  process.exit(0);
}

log(`Found ${names.length} profile(s):\n`);
for (const name of names) {
  try {
    const p = loadProfile(name);
    ok(`${name}  →  ${p.packageId}  (${p.host})`);
  } catch (e) {
    console.log(`  ${name}  →  INVALID: ${e.message}`);
  }
}
