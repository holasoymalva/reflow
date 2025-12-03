#!/usr/bin/env node

const { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, readFileSync } = require('fs');
const { join, relative } = require('path');
const { createGzip } = require('zlib');
const archiver = require('archiver');

const DIST_DIR = join(__dirname, '..', 'dist');
const OUTPUT_DIR = join(__dirname, '..', 'packages');
const MANIFEST_PATH = join(DIST_DIR, 'manifest.json');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read version from manifest
let version = '1.0.0';
if (existsSync(MANIFEST_PATH)) {
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
    version = manifest.version;
  } catch (err) {
    console.warn('Could not read version from manifest.json, using default:', version);
  }
}

const OUTPUT_FILE = join(OUTPUT_DIR, `reflow-v${version}.zip`);

console.log('📦 Packaging Chrome Extension...');
console.log(`   Source: ${DIST_DIR}`);
console.log(`   Output: ${OUTPUT_FILE}`);

// Create a file to stream archive data to
const output = createWriteStream(OUTPUT_FILE);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Listen for archive events
output.on('close', function() {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ Package created successfully!`);
  console.log(`   Size: ${sizeInMB} MB`);
  console.log(`   Location: ${OUTPUT_FILE}`);
});

archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn('Warning:', err);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add files from dist directory
function addDirectory(dirPath, archivePath = '') {
  const files = readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = join(dirPath, file);
    const stat = statSync(filePath);
    const archiveFilePath = archivePath ? join(archivePath, file) : file;
    
    if (stat.isDirectory()) {
      addDirectory(filePath, archiveFilePath);
    } else {
      // Skip source maps in production
      if (file.endsWith('.map')) {
        console.log(`   Skipping: ${archiveFilePath}`);
        return;
      }
      
      console.log(`   Adding: ${archiveFilePath}`);
      archive.file(filePath, { name: archiveFilePath });
    }
  });
}

// Check if dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error('❌ Error: dist directory not found. Run "npm run build:prod" first.');
  process.exit(1);
}

// Add all files from dist
addDirectory(DIST_DIR);

// Finalize the archive
archive.finalize();
