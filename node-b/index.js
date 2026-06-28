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
const PORT = Number(process.env.PORT) || 3002;

app.use(express.json());

// ── Apply token auth to ALL endpoints ─────────────────────────────────────
app.use(authMiddleware);

// ── GET /health ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', node: 'B', port: PORT });
});

// ── GET /patients ──────────────────────────────────────────────────────────
app.get('/patients', (req, res) => {
  const patients = getAllPatients();
  res.json({ node: 'B', count: patients.length, data: patients });
});

// ── GET /qi-groups ─────────────────────────────────────────────────────────
app.get('/qi-groups', (req, res) => {
  const groups = getQIGroups();
  res.json({ node: 'B', groups });
});

// ── GET /generalized ───────────────────────────────────────────────────────
app.get('/generalized', (req, res) => {
  const level    = parseInt(req.query.level) || 1;
  const patients = getGeneralizedPatients(level);
  res.json({ node: 'B', level, count: patients.length, data: patients });
});

// ── GET /check-anonymity ───────────────────────────────────────────────────
// Privacy-preserving endpoint: returns ONLY hashed QI group counts.
// Query params: ageLevel (0-3), zipLevel (0-4)
app.get('/check-anonymity', (req, res) => {
  const ageLevel = parseInt(req.query.ageLevel) || 0;
  const zipLevel = parseInt(req.query.zipLevel) || 0;

  if (ageLevel < 0 || ageLevel > 3 || zipLevel < 0 || zipLevel > 4) {
    return res.status(400).json({ error: 'ageLevel must be 0-3, zipLevel must be 0-4' });
  }

  const groups = getHashedQIGroups(ageLevel, zipLevel);
  res.json({ node: 'B', ageLevel, zipLevel, groups });
});

// ── POST /anonymized-data ──────────────────────────────────────────────────
// Returns generalized records after suppression of blacklisted QI hashes.
// Body: { ageLevel, zipLevel, blacklistedHashes: string[] }
app.post('/anonymized-data', (req, res) => {
  const { ageLevel = 0, zipLevel = 0, blacklistedHashes = [] } = req.body;

  if (typeof ageLevel !== 'number' || typeof zipLevel !== 'number') {
    return res.status(400).json({ error: 'ageLevel and zipLevel must be numbers' });
  }
  if (!Array.isArray(blacklistedHashes)) {
    return res.status(400).json({ error: 'blacklistedHashes must be an array' });
  }

  const data = getAnonymizedRecords(ageLevel, zipLevel, blacklistedHashes);
  res.json({ node: 'B', count: data.length, data });
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Node B running on http://localhost:${PORT}  [Auth: Bearer token required]`);
  });
}

start().catch(console.error);
