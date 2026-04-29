#!/usr/bin/env node
import 'dotenv/config';
import { signAccessToken } from './src/utils/jwt.js';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const adminToken = signAccessToken({ sub: '019ddb25-692d-7387-a6de-f97e0662f1e5', username: 'test-admin', role: 'admin' });

console.log('\n🧪 Testing Insighta Labs+ Backend\n');
console.log(`API Base: ${API_BASE}`);
console.log(`Admin Token: ${adminToken.substring(0, 50)}...\n`);

async function test(name, method, path, headers = {}) {
  try {
    console.log(`📍 ${method} ${path}`);
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...headers },
    });
    const status = response.status;
    const data = await response.json();
    console.log(`   ✓ Status: ${status}`);
    if (data.message || data.error) console.log(`   ℹ Message: ${data.message || data.error}`);
    console.log();
    return status;
  } catch (err) {
    console.log(`   ✗ Error: ${err instanceof Error ? err.message : err}\n`);
    return 0;
  }
}

async function main() {
  // Test unauthenticated access (should return 401)
  await test('Unauthenticated GET /api/profiles', 'GET', '/api/profiles');

  // Test authenticated but no version header (should return 400)
  await test(
    'Auth but no API version header',
    'GET',
    '/api/profiles',
    { Authorization: `Bearer ${adminToken}` }
  );

  // Test authenticated with version header (should return 200)
  await test(
    'Auth with API version header',
    'GET',
    '/api/profiles',
    { Authorization: `Bearer ${adminToken}`, 'X-API-Version': '1' }
  );

  // Test auth endpoints
  await test('GET /api/auth/github', 'GET', '/api/auth/github');
  await test('GET /api/auth/me (no auth)', 'GET', '/api/auth/me');
  await test('GET /api/auth/me (with auth)', 'GET', '/api/auth/me', { Authorization: `Bearer ${adminToken}` });

  console.log('✅ Tests complete!');
}

void main();
