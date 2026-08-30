#!/usr/bin/env node
'use strict';
/**
 * Defensive patch: the published @bubblewrap/core@1.25.0 template already
 * ships targetSdkVersion 36, but this script exists as a safety net in case
 * a future/older version of the dependency regresses, or you're patching a
 * project generated elsewhere (e.g. via pwabuilder.com or an older Bubblewrap
 * install). It's idempotent and safe to run multiple times.
 *
 * It also fixes 3 Play Console "Release > User experience" pre-launch
 * findings that show up on every Bubblewrap-generated project as of
 * @bubblewrap/core@1.25.0:
 *
 *   1. "Edge-to-edge may not display for all users" (targetSdk 35+)
 *   2. "Your app uses deprecated APIs or parameters for edge-to-edge"
 *      (setStatusBarColor / setNavigationBarColor / getStatusBarColor)
 *   3. "Improve your app's memory and performance with R8 optimization"
 *      (resource shrinking disabled, old AGP)
 *
 * Root cause of #1 and #2: the generated app/build.gradle pulls in
 * com.google.androidbrowserhelper:androidbrowserhelper:2.6.2, and it is
 * *that library's* LauncherActivity/WebViewFallbackActivity — not our
 * generated app code — that calls the deprecated Window APIs and doesn't
 * call enableEdgeToEdge(). Google fixed both upstream in androidbrowserhelper
 * 2.7.1 ("fix(launcher-activity): resolve deprecations") and added
 * edge-to-edge splash screen support in 2.7.0-alpha03+. So the fix is a
 * dependency version bump, not app source patching.
 * See: https://github.com/GoogleChrome/android-browser-helper/releases
 *
 * Root cause of #3: the template's release buildType sets minifyEnabled
 * true but never sets shrinkResources. Play Console's finding is resolved
 * by minifyEnabled + shrinkResources being true together — this works on
 * any AGP version. We also bump AGP to a recent, safe 8.x release (8.13.0)
 * for good measure, but deliberately do NOT jump to AGP 9.0+: that's a
 * heavy migration (hard-requires Gradle >= 9.1.0, changes/removes DSL like
 * lintOptions, enables built-in Kotlin by default, drops the legacy variant
 * API) that Bubblewrap's template has never been built or tested against.
 * See https://developer.android.com/topic/performance/app-optimization/enable-app-optimization
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

// Latest stable androidbrowserhelper as of this writing. Includes the
// upstream deprecated-API fix and edge-to-edge splash screen support.
// https://github.com/GoogleChrome/android-browser-helper
const ANDROID_BROWSER_HELPER_VERSION = '2.7.3';
// AGP version for the R8/optimization fix. Deliberately staying on the 8.x
// line rather than jumping to AGP 9.0: Play Console's "R8 optimization"
// finding is resolved by minifyEnabled + shrinkResources being true, on ANY
// AGP version — see https://developer.android.com/topic/performance/app-optimization/enable-app-optimization.
// "Upgrade AGP to 9.0+" in the Play Console message is a secondary
// suggestion, not a requirement to clear the finding.
// AGP 9.0 is a genuinely heavy migration (hard-requires Gradle >= 9.1.0,
// removes/changes DSL like lintOptions and compileSdkVersion, enables
// built-in Kotlin by default, removes the legacy variant API) that
// Bubblewrap's template (which still defaults to AGP 8.9.1) has never been
// built or tested against. Forcing it here risks trading one Play Console
// warning for a build that doesn't compile at all. If you want AGP 9 later,
// do it as its own deliberate, tested migration — not bundled into this fix.
const AGP_VERSION = '8.13.0';

function patchJcenter(profile) {
  const gradlePath = path.join(profile._outputDir, 'build.gradle');
  if (!fs.existsSync(gradlePath)) return;

  let content = fs.readFileSync(gradlePath, 'utf8');
  const original = content;

  content = content.replace(/jcenter\(\)/g, 'mavenCentral()');

  if (content === original) {
    ok('build.gradle repositories already free of jcenter().');
  } else {
    fs.writeFileSync(gradlePath, content, 'utf8');
    ok(`Patched ${gradlePath} → replaced deprecated jcenter() with mavenCentral().`);
  }
}

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

/**
 * Fixes Play Console findings #1 and #2 (edge-to-edge) by bumping the
 * androidbrowserhelper dependency, which owns LauncherActivity /
 * WebViewFallbackActivity and is where the deprecated Window APIs and
 * missing enableEdgeToEdge() call actually live — not in our app code.
 */
function patchAndroidBrowserHelperVersion(profile) {
  const gradlePath = path.join(profile._outputDir, 'app', 'build.gradle');
  if (!fs.existsSync(gradlePath)) return;

  let content = fs.readFileSync(gradlePath, 'utf8');
  const original = content;

  content = content.replace(
    /com\.google\.androidbrowserhelper:androidbrowserhelper:[0-9][\w.\-]*/g,
    `com.google.androidbrowserhelper:androidbrowserhelper:${ANDROID_BROWSER_HELPER_VERSION}`
  );

  if (content === original) {
    ok(`androidbrowserhelper dependency already at ${ANDROID_BROWSER_HELPER_VERSION} (or not found — verify manually if unsure).`);
  } else {
    fs.writeFileSync(gradlePath, content, 'utf8');
    ok(`Patched ${gradlePath} → androidbrowserhelper ${ANDROID_BROWSER_HELPER_VERSION} (fixes deprecated edge-to-edge APIs + adds enableEdgeToEdge()/splash-screen edge-to-edge support upstream).`);
  }
}

/**
 * Fixes Play Console finding #3 (R8 optimization) by:
 *  - enabling shrinkResources alongside the existing minifyEnabled
 *  - wiring up proguardFiles so shrinkResources has rules to work with
 *  - bumping AGP to a recent, safe 8.x release (8.13.0)
 *
 * Deliberately NOT jumping to AGP 9.0+ here — see AGP_VERSION comment above.
 * minifyEnabled + shrinkResources alone is what clears this specific Play
 * Console finding; no Gradle wrapper bump is needed for this AGP version
 * since the template's existing Gradle 8.11.1 already satisfies it.
 */
function patchR8Optimization(profile) {
  const appGradlePath = path.join(profile._outputDir, 'app', 'build.gradle');
  const rootGradlePath = path.join(profile._outputDir, 'build.gradle');
  const proguardPath = path.join(profile._outputDir, 'app', 'proguard-rules.pro');

  // Ensure a (possibly empty) proguard-rules.pro exists so proguardFiles
  // doesn't fail the build.
  if (!fs.existsSync(proguardPath)) {
    fs.writeFileSync(
      proguardPath,
      '# Add project specific ProGuard/R8 rules here.\n' +
      '# Generated TWA apps are thin WebView wrappers, so default rules\n' +
      '# from the Android Gradle Plugin are usually sufficient.\n',
      'utf8'
    );
    ok(`Created ${proguardPath}`);
  }

  if (fs.existsSync(appGradlePath)) {
    let content = fs.readFileSync(appGradlePath, 'utf8');
    const original = content;

    // Add shrinkResources + proguardFiles to the release buildType if not
    // already present. Matches the `release { minifyEnabled true }` block
    // generated by Bubblewrap's template.
    content = content.replace(
      /(buildTypes\s*\{\s*release\s*\{\s*minifyEnabled\s+true)(\s*\})/,
      (match, head, tail) => {
        if (/shrinkResources/.test(content)) return match; // already patched
        return `${head}\n            shrinkResources true\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'${tail}`;
      }
    );

    if (content === original) {
      ok('app/build.gradle release buildType already has shrinkResources (or pattern not found — verify manually).');
    } else {
      fs.writeFileSync(appGradlePath, content, 'utf8');
      ok(`Patched ${appGradlePath} → shrinkResources true + proguardFiles wired up.`);
    }
  }

  if (fs.existsSync(rootGradlePath)) {
    let content = fs.readFileSync(rootGradlePath, 'utf8');
    const original = content;

    content = content.replace(
      /com\.android\.tools\.build:gradle:[0-9][\w.\-]*/,
      `com.android.tools.build:gradle:${AGP_VERSION}`
    );

    if (content === original) {
      ok(`Top-level build.gradle already on AGP ${AGP_VERSION} (or pattern not found — verify manually).`);
    } else {
      fs.writeFileSync(rootGradlePath, content, 'utf8');
      ok(`Patched ${rootGradlePath} → Android Gradle Plugin ${AGP_VERSION}.`);
    }
  }
}

const profileName = args.profile || args._[0];
const profile = loadProfile(profileName);
patchJcenter(profile);
patchFile(profile);
patchAndroidBrowserHelperVersion(profile);
patchR8Optimization(profile);