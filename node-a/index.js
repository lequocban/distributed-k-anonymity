const express    = require('express');
const path       = require('path');
const { authMiddleware } = require(path.join(__dirname, '../auth'));
const {
  initDatabase,
  getAllPatients,
  getQIGroups,
  getGeneralizedPatients,
  getHashedQIGroups,
  getAnonymizedRecords,
} = require('./database');

const app  = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());

// ── Apply token auth to ALL endpoints ─────────────────────────────────────
app.use(authMiddleware);

// ── GET /health ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', node: 'A', port: PORT });
});

// ── GET /patients ── raw data (Coordinator may still use for full IL calc) ─
app.get('/patients', (req, res) => {
  const patients = getAllPatients();
  res.json({ node: 'A', count: patients.length, data: patients });
});

// ── GET /qi-groups ─────────────────────────────────────────────────────────
app.get('/qi-groups', (req, res) => {
  const groups = getQIGroups();
  res.json({ node: 'A', groups });
});

// ── GET /generalized ───────────────────────────────────────────────────────
app.get('/generalized', (req, res) => {
  const level    = parseInt(req.query.level) || 1;
  const patients = getGeneralizedPatients(level);
  res.json({ node: 'A', level, count: patients.length, data: patients });
});

// ── GET /check-anonymity ───────────────────────────────────────────────────
// Privacy-preserving endpoint: returns ONLY hashed QI group counts.
// The Coordinator can verify k-anonymity without seeing any raw identifiers.
//
// Query params:
//   ageLevel (0-3)  — Age generalization level
//   zipLevel (0-4)  — ZipCode generalization level
//
// Response: { node, ageLevel, zipLevel, groups: [ { hash, count }, ... ] }
app.get('/check-anonymity', (req, res) => {
  const ageLevel = parseInt(req.query.ageLevel) || 0;
  const zipLevel = parseInt(req.query.zipLevel) || 0;

  if (ageLevel < 0 || ageLevel > 3 || zipLevel < 0 || zipLevel > 4) {
    return res.status(400).json({ error: 'ageLevel must be 0-3, zipLevel must be 0-4' });
  }

  const groups = getHashedQIGroups(ageLevel, zipLevel);
  res.json({ node: 'A', ageLevel, zipLevel, groups });
});

// ── POST /anonymized-data ──────────────────────────────────────────────────
// Returns generalized patient records after suppressing blacklisted groups.
// blacklistedHashes: SHA-256 hashes of QI groups that violated k-anonymity globally.
// The node filters these out locally — raw patient data never leaves the node un-suppressed.
//
// Body: { ageLevel, zipLevel, blacklistedHashes: string[] }
// Response: { node, count, data: [ { id, age_gen, gender, zip_gen, disease }, ... ] }
app.post('/anonymized-data', (req, res) => {
  const { ageLevel = 0, zipLevel = 0, blacklistedHashes = [] } = req.body;

  if (typeof ageLevel !== 'number' || typeof zipLevel !== 'number') {
    return res.status(400).json({ error: 'ageLevel and zipLevel must be numbers' });
  }
  if (!Array.isArray(blacklistedHashes)) {
    return res.status(400).json({ error: 'blacklistedHashes must be an array' });
  }

  const data = getAnonymizedRecords(ageLevel, zipLevel, blacklistedHashes);
  res.json({ node: 'A', count: data.length, data });
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Node A running on http://localhost:${PORT}  [Auth: Bearer token required]`);
  });
}

start().catch(console.error);
