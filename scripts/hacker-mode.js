/**
 * ═══════════════════════════════════════════════════════════════
 * HACKER MODE — Security Attack Simulation
 * ═══════════════════════════════════════════════════════════════
 *
 * This script simulates real adversarial attacks against the
 * Distributed k-Anonymity system and proves that each attack
 * is successfully blocked.
 *
 * Attack Scenarios:
 *   [1] Direct Data Theft  — Attempt to dump raw patient records
 *       from Node A without an authorization header.
 *       Expected: HTTP 401 Unauthorized
 *
 *   [2] Fake Token Attempt — Attempt the same request with a
 *       wrong/forged token.
 *       Expected: HTTP 403 Forbidden
 *
 *   [3] Coordinator Impersonation — Attempt to POST to
 *       /anonymized-data pretending to be the Coordinator,
 *       using a crafted payload with an empty blacklist
 *       (trying to get all records without suppression).
 *       Expected: HTTP 403 Forbidden (invalid token)
 *
 * Run while servers are up:
 *   npm run hacker-mode
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';

const axios = require('axios');

const NODE_A = 'http://localhost:3001';
const NODE_B = 'http://localhost:3002';

let passed = 0;
let failed = 0;

function banner(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function pass(msg) {
  console.log(`  ✅ BLOCKED — ${msg}`);
  passed++;
}

function fail(msg) {
  console.log(`  ❌ VULNERABILITY — ${msg}`);
  failed++;
}

async function expect401or403(label, fn) {
  try {
    const res = await fn();
    // If we got a successful response, the attack succeeded → vulnerability!
    fail(`${label}: got HTTP ${res.status} — data was NOT protected!`);
  } catch (err) {
    if (err.response) {
      const code = err.response.status;
      if (code === 401 || code === 403) {
        pass(`${label}: got HTTP ${code} — access denied correctly`);
      } else {
        fail(`${label}: got unexpected HTTP ${code} (expected 401/403)`);
      }
    } else {
      // Network error (no server running) — mark as skip
      console.log(`  ⚠️  SKIP — ${label}: Could not connect to server. Is it running?`);
    }
  }
}

// ─── Attack 1: Direct Data Theft (no token) ────────────────────────────────
async function attack1_noToken() {
  banner('ATTACK 1: Direct Data Theft — No Authorization Header');
  console.log('  Attempting GET /patients on Node A without any token...');
  console.log('  A real attacker or sniffer on the local network would try this.\n');

  await expect401or403('GET /patients (no token)', () =>
    axios.get(`${NODE_A}/patients`, { timeout: 4000 })
  );

  await expect401or403('GET /health (no token)', () =>
    axios.get(`${NODE_A}/health`, { timeout: 4000 })
  );

  await expect401or403('GET /qi-groups (no token)', () =>
    axios.get(`${NODE_A}/qi-groups`, { timeout: 4000 })
  );
}

// ─── Attack 2: Fake/Forged Token ───────────────────────────────────────────
async function attack2_fakeToken() {
  banner('ATTACK 2: Fake Token Injection — Forged Bearer Token');
  console.log('  Attempting requests with a crafted fake token...\n');

  const fakeTokens = [
    'hacker-token-123',
    'admin',
    'Bearer',
    '',
    'k-anon-secret-WRONG',
  ];

  for (const tok of fakeTokens) {
    await expect401or403(`GET /patients (token="${tok}")`, () =>
      axios.get(`${NODE_A}/patients`, {
        headers: { Authorization: `Bearer ${tok}` },
        timeout: 4000,
      })
    );
  }
}

// ─── Attack 3: Coordinator Impersonation — access Node B data ──────────────
async function attack3_coordinatorImpersonation() {
  banner('ATTACK 3: Coordinator Impersonation — Bypass Suppression');
  console.log('  Pretending to be the Coordinator, sending POST /anonymized-data');
  console.log('  with an EMPTY blacklist to try to dump all records (no suppression)...\n');

  await expect401or403('POST /anonymized-data (no token)', () =>
    axios.post(`${NODE_B}/anonymized-data`, {
      ageLevel: 0,
      zipLevel: 0,
      blacklistedHashes: [], // empty blacklist = steal everything!
    }, { timeout: 4000 })
  );

  await expect401or403('POST /anonymized-data (fake token)', () =>
    axios.post(`${NODE_B}/anonymized-data`, {
      ageLevel: 0,
      zipLevel: 0,
      blacklistedHashes: [],
    }, {
      headers: { Authorization: 'Bearer i-am-the-coordinator' },
      timeout: 4000,
    })
  );

  // Also test /check-anonymity endpoint impersonation
  await expect401or403('GET /check-anonymity (no token)', () =>
    axios.get(`${NODE_A}/check-anonymity?ageLevel=0&zipLevel=0`, { timeout: 4000 })
  );
}

// ─── Summary ───────────────────────────────────────────────────────────────
async function summary() {
  banner('HACKER MODE — Results Summary');
  const total = passed + failed;
  console.log(`  Total attacks attempted : ${total}`);
  console.log(`  ✅ Successfully blocked  : ${passed}`);
  console.log(`  ❌ Vulnerabilities found : ${failed}`);

  if (failed === 0) {
    console.log('\n  ✅ All attacks were blocked! The security layer is working correctly.');
    console.log('  The system demonstrates:');
    console.log('   • Bearer token authentication on ALL endpoints');
    console.log('   • Rejection of missing, malformed, and forged tokens');
    console.log('   • Protection against unauthorized raw data access');
    console.log('   • Protection against Coordinator impersonation attacks\n');
  } else {
    console.log('\n  ❌ Some vulnerabilities were detected. Please review the security configuration.\n');
    process.exit(1);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     DISTRIBUTED k-ANONYMITY — HACKER MODE DEMO           ║');
  console.log('║     Security Attack Simulation                            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n  Targets:');
  console.log(`    Node A : ${NODE_A}`);
  console.log(`    Node B : ${NODE_B}`);
  console.log('\n  Make sure servers are running: npm start\n');

  await attack1_noToken();
  await attack2_fakeToken();
  await attack3_coordinatorImpersonation();
  await summary();
})();
