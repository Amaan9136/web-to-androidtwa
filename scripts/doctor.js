#!/usr/bin/env node
'use strict';
/**
 * Checks that the local machine has everything needed to build a signed
 * Android App Bundle: Node, Java (JDK 17+), and optionally the Android SDK
 * (Bubblewrap can auto-download its own JDK/SDK on first run if missing).
 */
const { spawnSync } = require('child_process');
const { log, ok, warn, fail } = require('../lib/shell');

function checkVersion(cmd, args, label) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    warn(`${label} not found on PATH (${cmd})`);
    return false;
  }
  const out = (res.stdout || res.stderr || '').split('\n')[0];
  ok(`${label}: ${out.trim()}`);
  return true;
}

log('Running environment checks...\n');

const hasNode = checkVersion('node', ['--version'], 'Node.js');
const hasJava = checkVersion('java', ['-version'], 'Java');
const hasKeytool = checkVersion('keytool', ['-help'], 'keytool (JDK)');

console.log('');
if (!hasNode) fail('Node.js is required. Install Node 18+ from https://nodejs.org');
if (!hasJava) warn('Java (JDK 17+) not found. Bubblewrap can install its own JDK on first `bubblewrap init`, or install via https://adoptium.net');
if (!hasKeytool) warn('keytool not found — it ships with the JDK, needed for keystore creation/inspection.');

console.log('');
log('If Java/Android SDK are missing, Bubblewrap will offer to download them');
log('automatically the first time you run "npm run build". That download is');
log('large (~1GB) — ensure you have disk space and network access.');
