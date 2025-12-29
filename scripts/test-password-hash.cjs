#!/usr/bin/env node
/**
 * Test script to verify password hashing matches client-side implementation
 * 
 * Usage: node scripts/test-password-hash.cjs <password>
 */

const crypto = require('crypto');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/test-password-hash.cjs <password>');
  console.error('Example: node scripts/test-password-hash.cjs "test_review_password_123"');
  process.exit(1);
}

// Simulate client-side hashing (same as browser crypto.subtle.digest)
const hash = crypto.createHash('sha256').update(password, 'utf8').digest('hex');

console.log('Password:', password);
console.log('Password length:', password.length);
console.log('SHA256 Hash:', hash);
console.log('Hash length:', hash.length);
console.log('');
console.log('Add to .env:');
console.log(`NEXT_PUBLIC_ARKIV_REVIEW_PASSWORD_SHA256=${hash}`);
