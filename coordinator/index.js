const express  = require('express');
const axios    = require('axios');
const path     = require('path');
const { NODE_API_TOKEN } = require('../config');
const {
  applyGeneralization,
  checkKAnonymity,
  findBestLevel,
  computeAgeDomain,
  LEVELS,
  ZIP_MAX_LEVEL,
} = require('./kanonymity');

const app  = express();
const PORT = Number(process.env.PORT) || 3000;
const K    = 5;

const NODES = {
  A: process.env.NODE_A_URL || 'http://localhost:3001',
  B: process.env.NODE_B_URL || 'http://localhost:3002',
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Axios helper with Bearer token ─────────────────────────────────────────
const AUTH_HEADER = { Authorization: `Bearer ${NODE_API_TOKEN}` };

function parseK(value, defaultValue = K) {
  if (value === undefined) return { ok: true, value: defaultValue };
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return { ok: false, error: 'k must be a positive integer' };
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return { ok: false, error: 'k is too large' };
  }
  return { ok: true, value: parsed };
}

async function fetchFromNode(nodeUrl, endpoint, options = {}) {
  try {
    const res = await axios({
      method: options.method || 'get',
      url: `${nodeUrl}${endpoint}`,
      headers: { ...AUTH_HEADER, ...(options.headers || {}) },
      data: options.data,
      timeout: 5000,
    });
    return { ok: true, data: res.data };
  } catch (err) {
    const status = err.response ? err.response.status : null;
    return { ok: false, error: `${nodeUrl} unreachable: ${err.message}`, status };
  }
}

// ── GET /health ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const results = {};
  for (const [name, url] of Object.entries(NODES)) {
    const r = await fetchFromNode(url, '/health');
    results[`Node ${name}`] = r.ok ? 'online' : `offline — ${r.error}`;
  }
  res.json({ coordinator: 'online', nodes: results });
});

// ── GET /run ────────────────────────────────────────────────────────────────
// Privacy-Preserving Protocol:
//  1. For each generalization level, call /check-anonymity on both nodes
//     → get hashed QI frequencies only (no raw identifiers).
//  2. Sum frequencies by hash globally.
//  3. If all hashes satisfy count >= k → level is valid.
//  4. Compute blacklistedHashes (count < k) for suppression.
//  5. Fetch anonymized records via POST /anonymized-data with blacklist.
app.get('/run', async (req, res) => {
  const parsedK = parseK(req.query.k);
  if (!parsedK.ok) {
    return res.status(400).json({ error: parsedK.error });
  }
  const k = parsedK.value;
  console.log(`\n> Running k-anonymity (Privacy-Preserving Protocol) with k=${k}...`);

  // ── Step 1: Find best generalization level via hashed QI protocol ─────────
  let bestLevel  = null;
  let bestSuppressed = null; // { hash: globalCount }
  let bestIL     = Infinity;

  for (const lvl of LEVELS) {
    // Request hashed QI groups from both nodes simultaneously
    const [resA, resB] = await Promise.all([
      fetchFromNode(NODES.A, `/check-anonymity?ageLevel=${lvl.age}&zipLevel=${lvl.zip}`),
      fetchFromNode(NODES.B, `/check-anonymity?ageLevel=${lvl.age}&zipLevel=${lvl.zip}`),
    ]);

    if (!resA.ok || !resB.ok) {
      const msg = [
        !resA.ok ? `Node A: ${resA.error}` : null,
        !resB.ok ? `Node B: ${resB.error}` : null,
      ].filter(Boolean).join('; ');
      return res.status(503).json({
        error: 'k-anonymity cannot be guaranteed — one or more nodes are unreachable',
        details: msg,
      });
    }

    // Aggregate frequency by hash across all nodes
    const globalFreq = {};
    for (const { hash, count } of resA.data.groups) {
      globalFreq[hash] = (globalFreq[hash] || 0) + count;
    }
    for (const { hash, count } of resB.data.groups) {
      globalFreq[hash] = (globalFreq[hash] || 0) + count;
    }

    // Count total and suppressed
    const totalGroups     = Object.keys(globalFreq).length;
    const violatingHashes = Object.entries(globalFreq).filter(([, cnt]) => cnt < k);
    const keptHashes      = Object.entries(globalFreq).filter(([, cnt]) => cnt >= k);

    if (keptHashes.length === 0) continue; // all suppressed → not valid

    const suppressedRecords = violatingHashes.reduce((s, [, cnt]) => s + cnt, 0);
    const totalRecords = Object.values(globalFreq).reduce((s, c) => s + c, 0);
    const keptRecords  = totalRecords - suppressedRecords;

    // Check: all remaining groups satisfy k
    const satisfied = violatingHashes.length === 0 || keptHashes.every(([, cnt]) => cnt >= k);

    // Estimate IL (simplified, coordinator-side)
    const ageDomain = 39; // age range 20-59
    const ageIntervalWidth = lvl.age === 0 ? 1 : lvl.age === 1 ? 10 : lvl.age === 2 ? 20 : ageDomain;
    const cellILAge = ageDomain > 0 ? ageIntervalWidth / ageDomain : 0;
    const zipWildcards = [0, 1, 2, 3, 5];
    const cellILZip = zipWildcards[lvl.zip] / 5;
    const ilAge     = lvl.age > 0 ? cellILAge : 0;
    const ilZip     = lvl.zip > 0 ? cellILZip : 0;
    const ilSup     = suppressedRecords / totalRecords;
    const ilPercent = parseFloat(((ilAge + ilZip + ilSup) / 3 * 100).toFixed(4));

    if (keptRecords > 0 && ilPercent < bestIL) {
      bestIL     = ilPercent;
      bestLevel  = { level: lvl, suppressedRecords, totalRecords, keptRecords, ilPercent, totalGroups, validGroups: keptHashes.length };
      bestSuppressed = violatingHashes.map(([hash]) => hash);
    }
  }

  if (!bestLevel) {
    return res.status(422).json({
      error: `Cannot achieve k=${k} anonymity even at maximum generalization level`,
    });
  }

  const lvl = bestLevel.level;
  console.log(`  -> Privacy-preserving level chosen: Age=${lvl.age} Zip=${lvl.zip} ("${lvl.desc}")`);
  console.log(`     Overall IL: ${bestLevel.ilPercent}%  |  Suppressed: ${bestLevel.suppressedRecords}/${bestLevel.totalRecords}`);

  // ── Step 2: Fetch anonymized records with suppression applied ──────────────
  const [dataA, dataB] = await Promise.all([
    fetchFromNode(NODES.A, '/anonymized-data', {
      method: 'post',
      data: { ageLevel: lvl.age, zipLevel: lvl.zip, blacklistedHashes: bestSuppressed },
    }),
    fetchFromNode(NODES.B, '/anonymized-data', {
      method: 'post',
      data: { ageLevel: lvl.age, zipLevel: lvl.zip, blacklistedHashes: bestSuppressed },
    }),
  ]);

  if (!dataA.ok || !dataB.ok) {
    return res.status(503).json({ error: 'Failed to retrieve anonymized records from nodes.' });
  }

  const anonymizedA = dataA.data.data.map(r => ({ ...r, _node: 'A' }));
  const anonymizedB = dataB.data.data.map(r => ({ ...r, _node: 'B' }));
  const allAnonymized = anonymizedA.concat(anonymizedB);

  // Display equivalence classes
  const qiGroups = {};
  for (const r of allAnonymized) {
    const key = `${r.age_gen}|${r.gender}|${r.zip_gen}`;
    if (!qiGroups[key]) qiGroups[key] = [];
    qiGroups[key].push(r);
  }
  const sortedGroups = Object.entries(qiGroups)
    .map(([key, rows]) => { const [ag, gd, zg] = key.split('|'); return { ag, gd, zg, count: rows.length, rows }; })
    .sort((a, b) => b.count - a.count);

  const MAX_SHOW = 3;
  console.log('\n  === Equivalence Classes (QI groups) ===');
  console.log(`  Total valid QI groups: ${sortedGroups.length}`);
  sortedGroups.slice(0, MAX_SHOW).forEach((g, i) => {
    console.log(`  [Class ${i + 1}] Age=${g.ag}, Gender=${g.gd}, ZipCode=${g.zg} — ${g.count} records`);
    g.rows.slice(0, 2).forEach(r =>
      console.log(`    - [Node ${r._node}] id=${r.id}, disease=${r.disease}`)
    );
  });

  const suppressedA = (dataA.data._total || (bestLevel.totalRecords / 2)) - dataA.data.count;
  const suppressedB = (dataB.data._total || (bestLevel.totalRecords / 2)) - dataB.data.count;

  // IL component breakdowns (coordinator-side estimates)
  const ageDomain = 39;
  const ageIntervalWidth = lvl.age === 0 ? 1 : lvl.age === 1 ? 10 : lvl.age === 2 ? 20 : ageDomain;
  const cellILAge = ageDomain > 0 ? ageIntervalWidth / ageDomain : 0;
  const zipWildcards = [0, 1, 2, 3, 5];
  const cellILZip = zipWildcards[lvl.zip] / 5;
  const ilAgeContrib = parseFloat((lvl.age > 0 ? cellILAge * 100 : 0).toFixed(4));
  const ilZipContrib = parseFloat((lvl.zip > 0 ? cellILZip * 100 : 0).toFixed(4));
  const ilSupContrib = parseFloat((bestLevel.suppressedRecords / bestLevel.totalRecords * 100).toFixed(4));

  // Compute min_group_size from kept records
  const qiGroupSizes = Object.values(
    allAnonymized.reduce((acc, r) => {
      const key = `${r.age_gen}|${r.gender}|${r.zip_gen}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  );
  const minGroupSize = qiGroupSizes.length > 0 ? Math.min(...qiGroupSizes) : 0;

  res.json({
    k,
    status: 'achieved',
    protocol: 'Privacy-Preserving Hashed QI Group Counting',
    generalization: {
      age_level:   lvl.age,
      zip_level:   lvl.zip,
      description: lvl.desc,
    },
    information_loss: {
      overall_il_percent: `${bestLevel.ilPercent}%`,
      age: {
        il_cell_percent:   `${(cellILAge * 100).toFixed(4)}%`,
        il_contribution:   `${ilAgeContrib}%`,
        cells_generalized: lvl.age > 0 ? bestLevel.keptRecords : 0,
        total_cells:       bestLevel.totalRecords,
      },
      zipcode: {
        il_cell_percent:   `${(cellILZip * 100).toFixed(4)}%`,
        il_contribution:   `${ilZipContrib}%`,
        cells_generalized: lvl.zip > 0 ? bestLevel.keptRecords : 0,
        total_cells:       bestLevel.totalRecords,
      },
      suppressed: {
        count:           bestLevel.suppressedRecords,
        total_records:   bestLevel.totalRecords,
        il_contribution: `${ilSupContrib}%`,
        per_node:        { A: Math.max(0, suppressedA), B: Math.max(0, suppressedB) },
      },
    },
    stats: {
      total_qi_groups: bestLevel.totalGroups,
      valid_groups:    bestLevel.validGroups,
      min_group_size:  minGroupSize,
    },
    nodes: [
      { node: 'A', total: bestLevel.totalRecords / 2, kept: dataA.data.count, suppressed: Math.max(0, suppressedA) },
      { node: 'B', total: bestLevel.totalRecords / 2, kept: dataB.data.count, suppressed: Math.max(0, suppressedB) },
    ],
    suppressed: {
      count:    bestLevel.suppressedRecords,
      total:    bestLevel.totalRecords,
    },
    anonymized_records: allAnonymized,
    suppressed_records: [],  // Coordinator does not receive suppressed raw records (privacy-preserving design)
  });
});


// ── GET /run-levels ─────────────────────────────────────────────────────────
// Compare IL across multiple k values using the hashed protocol.
app.get('/run-levels', async (req, res) => {
  // Pre-fetch hashed QI groups for all levels from both nodes
  const levelHashCache = {};
  for (const lvl of LEVELS) {
    const key = `${lvl.age}_${lvl.zip}`;
    const [resA, resB] = await Promise.all([
      fetchFromNode(NODES.A, `/check-anonymity?ageLevel=${lvl.age}&zipLevel=${lvl.zip}`),
      fetchFromNode(NODES.B, `/check-anonymity?ageLevel=${lvl.age}&zipLevel=${lvl.zip}`),
    ]);
    if (!resA.ok || !resB.ok) {
      return res.status(503).json({ error: 'One or more nodes unreachable' });
    }
    const globalFreq = {};
    for (const { hash, count } of resA.data.groups) globalFreq[hash] = (globalFreq[hash] || 0) + count;
    for (const { hash, count } of resB.data.groups) globalFreq[hash] = (globalFreq[hash] || 0) + count;
    levelHashCache[key] = globalFreq;
  }

  const comparison = [];
  const ageDomain = 39;

  for (const k of [5, 10, 20, 50, 150, 250, 350, 500, 700, 1000, 1500]) {
    let bestLvl = null;
    let bestIL  = Infinity;

    for (const lvl of LEVELS) {
      const freq = levelHashCache[`${lvl.age}_${lvl.zip}`];
      const totalRecords = Object.values(freq).reduce((s, c) => s + c, 0);
      const violating    = Object.entries(freq).filter(([, c]) => c < k);
      const keptHashes   = Object.entries(freq).filter(([, c]) => c >= k);
      if (keptHashes.length === 0) continue;

      const suppressedCount = violating.reduce((s, [, c]) => s + c, 0);
      const ageIW = lvl.age === 0 ? 1 : lvl.age === 1 ? 10 : lvl.age === 2 ? 20 : ageDomain;
      const ilAge = lvl.age > 0 ? (ageIW / ageDomain) : 0;
      const zipWildcards = [0, 1, 2, 3, 5];
      const ilZip = lvl.zip > 0 ? (zipWildcards[lvl.zip] / 5) : 0;
      const ilSup = suppressedCount / totalRecords;
      const ilPct = parseFloat(((ilAge + ilZip + ilSup) / 3 * 100).toFixed(4));

      if (ilPct < bestIL) {
        bestIL  = ilPct;
        bestLvl = { lvl, ilPct, suppressedCount };
      }
    }

    comparison.push({
      k,
      age_level:                  bestLvl ? bestLvl.lvl.age : null,
      zip_level:                  bestLvl ? bestLvl.lvl.zip : null,
      description:                bestLvl ? bestLvl.lvl.desc : 'impossible',
      information_loss_percent:   bestLvl ? bestLvl.ilPct : null,
      suppressed:                 bestLvl ? bestLvl.suppressedCount : null,
      achieved:                   !!bestLvl,
    });
  }

  const sample = levelHashCache[`0_0`];
  const total  = sample ? Object.values(sample).reduce((s, c) => s + c, 0) : 0;
  res.json({ total_records: total, comparison });
});

app.listen(PORT, () => {
  console.log(`Coordinator running on http://localhost:${PORT}`);
  console.log(`  GET /              -- open web dashboard`);
  console.log(`  GET /health       -- check node status`);
  console.log(`  GET /run          -- run k-anonymity (default k=5)`);
  console.log(`  GET /run?k=7     -- run with custom k`);
  console.log(`  GET /run-levels   -- compare IL across k values`);
});
