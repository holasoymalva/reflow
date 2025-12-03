#!/usr/bin/env node

const { existsSync, readFileSync, statSync } = require('fs');
const { join } = require('path');

const DIST_DIR = join(__dirname, '..', 'dist');

console.log('🔍 Verifying Production Build...\n');

let errors = 0;
let warnings = 0;

// Required files
const requiredFiles = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'options.html',
  'options.js',
  'devtools.html',
  'devtools.js',
  'panel.html',
  'panel.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

console.log('📋 Checking required files...');
requiredFiles.forEach(file => {
  const filePath = join(DIST_DIR, file);
  if (existsSync(filePath)) {
    const size = statSync(filePath).size;
    console.log(`  ✅ ${file} (${(size / 1024).toFixed(2)} KB)`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    errors++;
  }
});

console.log('');

// Check manifest.json validity
console.log('📄 Validating manifest.json...');
try {
  const manifestPath = join(DIST_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  if (manifest.manifest_version === 3) {
    console.log('  ✅ Manifest version 3');
  } else {
    console.log('  ❌ Invalid manifest version');
    errors++;
  }
  
  if (manifest.name && manifest.version && manifest.description) {
    console.log(`  ✅ Name: ${manifest.name}`);
    console.log(`  ✅ Version: ${manifest.version}`);
    console.log(`  ✅ Description: ${manifest.description}`);
  } else {
    console.log('  ❌ Missing required manifest fields');
    errors++;
  }
  
  if (manifest.permissions && manifest.permissions.length > 0) {
    console.log(`  ✅ Permissions: ${manifest.permissions.length} declared`);
  } else {
    console.log('  ⚠️  No permissions declared');
    warnings++;
  }
} catch (err) {
  console.log(`  ❌ Error reading manifest: ${err.message}`);
  errors++;
}

console.log('');

// Check for source maps (should not be in production)
console.log('🗺️  Checking for source maps...');
const sourceMapFiles = requiredFiles.filter(f => f.endsWith('.js')).map(f => f + '.map');
let hasMaps = false;
sourceMapFiles.forEach(file => {
  const filePath = join(DIST_DIR, file);
  if (existsSync(filePath)) {
    console.log(`  ⚠️  ${file} - Source map present (will be excluded from package)`);
    hasMaps = true;
  }
});
if (!hasMaps) {
  console.log('  ✅ No source maps in dist (good for production)');
}

console.log('');

// Calculate total size
console.log('📊 Build Statistics...');
let totalSize = 0;
requiredFiles.forEach(file => {
  const filePath = join(DIST_DIR, file);
  if (existsSync(filePath)) {
    totalSize += statSync(filePath).size;
  }
});
console.log(`  Total size: ${(totalSize / 1024).toFixed(2)} KB`);
console.log(`  Compressed estimate: ~${(totalSize / 1024 / 3).toFixed(2)} KB`);

console.log('');

// Summary
console.log('📝 Summary');
console.log(`  Errors: ${errors}`);
console.log(`  Warnings: ${warnings}`);

if (errors === 0) {
  console.log('\n✅ Build verification passed! Ready for packaging.');
  process.exit(0);
} else {
  console.log('\n❌ Build verification failed. Please fix errors before packaging.');
  process.exit(1);
}
