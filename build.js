#!/usr/bin/env node
/* ============================================================
   BUILD SCRIPT
   Reads SECRET_CODE and SECRET_MESSAGE from environment,
   hashes the code (SHA-256), encrypts the message (AES-GCM),
   and injects the results into index.html → dist/
   ============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- Load .env file if present ----
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
  console.log('📄 Loaded .env file');
}

// ---- Read env vars ----
const SECRET_CODE = process.env.SECRET_CODE;
const SECRET_MESSAGE = process.env.SECRET_MESSAGE;

if (!SECRET_CODE || !SECRET_MESSAGE) {
  console.error('❌ Missing environment variables: SECRET_CODE and SECRET_MESSAGE are required.');
  process.exit(1);
}

console.log(`🔑 Code length: ${SECRET_CODE.length} characters`);

// ---- SHA-256 hash of the code ----
const codeHash = crypto.createHash('sha256').update(SECRET_CODE).digest('hex');
console.log(`🔒 Code hash: ${codeHash}`);

// ---- AES-GCM encrypt the message ----
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);

// Derive key using PBKDF2 (must match browser-side params)
const key = crypto.pbkdf2Sync(SECRET_CODE, salt, 100000, 32, 'sha256');

const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(SECRET_MESSAGE, 'utf8');
encrypted = Buffer.concat([encrypted, cipher.final()]);
const authTag = cipher.getAuthTag();

// Combine ciphertext + authTag (Web Crypto API expects them together)
const encryptedWithTag = Buffer.concat([encrypted, authTag]);

const encryptedB64 = encryptedWithTag.toString('base64');
const ivB64 = iv.toString('base64');
const saltB64 = salt.toString('base64');

console.log(`🔐 Encrypted message: ${encryptedB64.substring(0, 30)}...`);

// ---- Build output ----
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// Read and inject index.html
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const timestamp = Date.now();
html = html.replace('__CODE_HASH__', codeHash);
html = html.replace('__ENCRYPTED_MESSAGE__', encryptedB64);
html = html.replace('__CODE_LENGTH__', SECRET_CODE.length.toString());
html = html.replace('__IV__', ivB64);
html = html.replace('__SALT__', saltB64);

// Cache busting
html = html.replace('style.css', `style.css?v=${timestamp}`);
html = html.replace('script.js', `script.js?v=${timestamp}`);
html = html.replace('assets/logo.svg', `assets/logo.svg?v=${timestamp}`);

fs.writeFileSync(path.join(distDir, 'index.html'), html);
console.log('✅ dist/index.html written');

// Copy static assets
for (const file of ['style.css', 'script.js']) {
  fs.copyFileSync(path.join(__dirname, file), path.join(distDir, file));
  console.log(`✅ dist/${file} copied`);
}

// Copy assets folder
const assetsDir = path.join(__dirname, 'assets');
const distAssetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  if (!fs.existsSync(distAssetsDir)) fs.mkdirSync(distAssetsDir, { recursive: true });
  const files = fs.readdirSync(assetsDir);
  for (const file of files) {
    fs.copyFileSync(path.join(assetsDir, file), path.join(distAssetsDir, file));
  }
  console.log(`✅ dist/assets/ copied (${files.length} files)`);
}

console.log('\n🎉 Build complete! Open dist/index.html to test.');
