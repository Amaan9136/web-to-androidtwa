'use strict';
const { spawnSync } = require('child_process');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg) { console.log(`${COLORS.cyan}[webtwa]${COLORS.reset} ${msg}`); }
function ok(msg) { console.log(`${COLORS.green}[ok]${COLORS.reset} ${msg}`); }
function warn(msg) { console.warn(`${COLORS.yellow}[warn]${COLORS.reset} ${msg}`); }
function fail(msg) {
  console.error(`${COLORS.red}${COLORS.bold}[error]${COLORS.reset} ${msg}`);
  process.exitCode = 1;
}

/**
 * Runs a command synchronously, streaming output, and throws on non-zero exit.
 */
function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
  }
  return res;
}

/**
 * Like run(), but does not throw — returns { status, error } so callers
 * can decide how to handle failure (used for optional/best-effort steps).
 */
function tryRun(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  return res;
}

module.exports = { log, ok, warn, fail, run, tryRun, COLORS };
