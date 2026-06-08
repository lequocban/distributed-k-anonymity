/**
 * Verify IL across all generalization levels for the generated dataset.
 * Run: node verify-dataset.js
 */
const initSqlJs = require('sql.js');
const path     = require('path');
const {
  applyGeneralization,
  computeAgeDomain,
  evaluateLevel,
  findBestLevel,
  LEVELS,
} = require('../coordinator/kanonymity');

const DB_A = path.join(__dirname, '..', 'node-a',  'site_a.db');
const DB_B = path.join(__dirname, '..', 'node-b',  'site_b.db');

async function loadPatients(dbPath) {
  const SQL = await initSqlJs();
  const buf  = require('fs').readFileSync(dbPath);
  const db   = new SQL.Database(buf);
  const stmt  = db.prepare('SELECT age, gender, zipcode, disease FROM patients');
  const rows  = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    r.zipcode = String(r.zipcode);
    rows.push(r);
  }
  stmt.free();
  db.close();
  return rows;
}

async function main() {
  const patientsA = await loadPatients(DB_A);
  const patientsB = await loadPatients(DB_B);
  const all = patientsA.map(r => ({ ...r, _node: 'A' }))
    .concat(patientsB.map(r => ({ ...r, _node: 'B' })));

  console.log(`Total records: ${all.length} (A=${patientsA.length}, B=${patientsB.length})\n`);

  const ageDomain = computeAgeDomain(all);
  console.log(`Age domain: ${ageDomain.min} - ${ageDomain.max} (width=${ageDomain.width})\n`);

  // Show group sizes at level (0,0)
  const gen0 = applyGeneralization(all, 0, 0);
  const groups0 = {};
  for (const r of gen0) {
    const key = `${r.age_gen}|${r.gender}|${r.zip_gen}`;
    groups0[key] = (groups0[key] || 0) + 1;
  }
  const counts0 = Object.values(groups0);
  const countBuckets = {};
  for (const c of counts0) {
    countBuckets[c] = (countBuckets[c] || 0) + 1;
  }
  console.log('Level (0,0) group sizes:');
  for (const [sz, cnt] of Object.entries(countBuckets).sort((a,b) => +a[0] - +b[0])) {
    console.log(`  size=${sz}: ${cnt} groups`);
  }
  console.log('');

  // IL per level at k=5
  console.log('IL breakdown by level (k=5):');
  console.log('═'.repeat(115));
  console.log(`${'Level'.padEnd(6)} ${'A/Z'.padEnd(5)} ${'Overall'.padEnd(10)} ${'Age_Cell'.padEnd(12)} ${'Zip_Cell'.padEnd(12)} ${'SupIL'.padEnd(10)} ${'Suppressed'.padEnd(12)} ${'Groups'.padEnd(7)} Status`);
  console.log('═'.repeat(115));

  for (const lvl of LEVELS) {
    const evaluation = evaluateLevel(all, lvl.age, lvl.zip, 5, ageDomain);
    const result = evaluation.result;
    const supCount = evaluation.suppressedCount;
    const il = evaluation.il;
    const status = evaluation.keptCount > 0 && result.satisfied ? '✓' : '✗';
    console.log(
      `${lvl.desc.substring(0, 22).padEnd(6)} ` +
      `${lvl.age}/${lvl.zip}`.padEnd(5) +
      `${il.ilPercent}%`.padEnd(10) +
      `${il.cellILAge}%`.padEnd(12) +
      `${il.cellILZip}%`.padEnd(12) +
      `${il.ilSuppressPercent}%`.padEnd(10) +
      `${supCount}/${all.length}`.padEnd(12) +
      `${result.totalGroups}`.padEnd(7) +
      status
    );
  }

  console.log('\n\nBest level for different k values:');
  console.log('═'.repeat(95));
  console.log(`${'k'.padEnd(5)} ${'Level'.padEnd(6)} ${'Overall'.padEnd(10)} ${'Age_Cell'.padEnd(12)} ${'Zip_Cell'.padEnd(12)} ${'Suppressed'.padEnd(12)} Valid`);
  console.log('═'.repeat(95));

  for (const k of [5, 10, 20, 30, 50, 100, 500, 1000]) {
    const best = findBestLevel(all, k, ageDomain);
    if (best.level) {
      console.log(
        `k=${k}`.padEnd(5) +
        `(${best.level.age},${best.level.zip})`.padEnd(6) +
        `${best.eval.il.ilPercent}%`.padEnd(10) +
        `${best.eval.il.cellILAge}%`.padEnd(12) +
        `${best.eval.il.cellILZip}%`.padEnd(12) +
        `${best.eval.suppressedCount}/${all.length}`.padEnd(12) +
        `${best.eval.keptCount}/${all.length}`
      );
    } else {
      console.log(`k=${k}`.padEnd(5) + 'impossible even at max level');
    }
  }
}

main().catch(console.error);
