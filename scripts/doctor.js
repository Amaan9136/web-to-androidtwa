#!/usr/bin/env node
'use strict';
/**
 * Checks that the local machine has everything needed to build a signed
 * Android App Bundle: Node, Java (JDK 17+), and optionally the Android SDK
 * (Bubblewrap can auto-download its own JDK/SDK on first run if missing).
 */
const { spawnSync } = require('child_process');
const { log, ok, warn, fail } = require('../lib/shell');

// AGP 8.13.0 (used by patch-gradle.js to fix the R8/optimization Play
// Console finding) requires JDK 17+. Older JDKs fail the build outright.
const MIN_JAVA_MAJOR_VERSION = 17;

function checkVersion(cmd, args, label) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    warn(`${label} not found on PATH (${cmd})`);
    return { found: false, out: '' };
  }
  const out = (res.stdout || res.stderr || '').split('\n')[0];
  ok(`${label}: ${out.trim()}`);
  return { found: true, out };
}

function parseJavaMajorVersion(versionLine) {
  // Handles both old ("1.8.0_XXX") and modern ("17.0.9", "21.0.10") formats.
  const match = versionLine.match(/version\s+"(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const first = Number(match[1]);
  if (first === 1 && match[2]) return Number(match[2]); // "1.8" -> 8
  return first;
}

log('Running environment checks...\n');

const hasNode = checkVersion('node', ['--version'], 'Node.js');
const java = checkVersion('java', ['-version'], 'Java');
const hasKeytool = checkVersion('keytool', ['-help'], 'keytool (JDK)').found;

console.log('');
if (!hasNode.found) fail('Node.js is required. Install Node 18+ from https://nodejs.org');
if (!java.found) {
  warn('Java (JDK 17+) not found. Bubblewrap can install its own JDK on first `bubblewrap init`, or install via https://adoptium.net');
} else {
  const majorVersion = parseJavaMajorVersion(java.out);
  if (majorVersion === null) {
    warn(`Could not parse Java version from "${java.out}" — verify manually it is JDK ${MIN_JAVA_MAJOR_VERSION}+.`);
  } else if (majorVersion < MIN_JAVA_MAJOR_VERSION) {
    fail(`Java ${majorVersion} found, but JDK ${MIN_JAVA_MAJOR_VERSION}+ is required (Android Gradle Plugin 8.x+ needs it). Install a newer JDK, e.g. via https://adoptium.net`);
  } else {
    ok(`JDK ${majorVersion} meets the minimum required version (${MIN_JAVA_MAJOR_VERSION}+).`);
  }
}
if (!hasKeytool) warn('keytool not found — it ships with the JDK, needed for keystore creation/inspection.');

console.log('');
log('If Java/Android SDK are missing, Bubblewrap will offer to download them');
log('automatically the first time you run "npm run build". That download is');
log('large (~1GB) — ensure you have disk space and network access.');
