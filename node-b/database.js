const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');

const DB_PATH = path.join(__dirname, 'site_b.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE IF NOT EXISTS patients (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        age     INTEGER NOT NULL,
        gender  TEXT NOT NULL,
        zipcode TEXT NOT NULL,
        disease TEXT NOT NULL
      )
    `);
    save();
  }
}

function save() {
  if (!db) return;
  const buf = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(buf));
}

function getAllPatients() {
  const results = [];
  const stmt = db.prepare('SELECT * FROM patients');
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function getQIGroups() {
  const results = [];
  const stmt = db.prepare(`
    SELECT age, gender, zipcode, COUNT(*) as count
    FROM patients
    GROUP BY age, gender, zipcode
  `);
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function getGeneralizedPatients(level = 1) {
  const patients = getAllPatients();
  return patients.map(p => ({
    ...p,
    age_generalized: generalizeAge(p.age, level),
  }));
}

function generalizeAge(age, level = 1) {
  if (level === 0) return String(age);
  if (level === 1) {
    const base = Math.floor(age / 10) * 10;
    return `${base}-${base + 9}`;
  }
  if (level === 2) {
    const base = Math.floor(age / 20) * 20;
    return `${base}-${base + 19}`;
  }
  return '*';
}

function generalizeZipcode(zipcode, level) {
  const z = String(zipcode);
  if (level === 0) return z;
  if (level === 1) return `${z.slice(0, -1)}*`;
  if (level === 2) return `${z.slice(0, -2)}**`;
  if (level === 3) return `${z.slice(0, -3)}***`;
  if (level === 4) return '*****';
  return '*****';
}

/**
 * Hash a generalized QI tuple using SHA-256.
 * The Coordinator only learns the hash, never the raw values.
 */
function hashQI(ageGen, gender, zipGen) {
  return crypto
    .createHash('sha256')
    .update(`${ageGen}|${gender}|${zipGen}`)
    .digest('hex');
}

/**
 * Compute hashed QI group frequencies for a given generalization level.
 * Returns [ { hash, count } ] — no raw values are included.
 */
function getHashedQIGroups(ageLevel, zipLevel) {
  const patients = getAllPatients();
  const freq = {};

  for (const p of patients) {
    const ageGen = ageLevel === 0 ? String(p.age)
      : ageLevel === 1 ? `${Math.floor(p.age / 10) * 10}-${Math.floor(p.age / 10) * 10 + 9}`
      : ageLevel === 2 ? `${Math.floor(p.age / 20) * 20}-${Math.floor(p.age / 20) * 20 + 19}`
      : '*';
    const zipGen = generalizeZipcode(p.zipcode, zipLevel);
    const h = hashQI(ageGen, p.gender, zipGen);
    freq[h] = (freq[h] || 0) + 1;
  }

  return Object.entries(freq).map(([hash, count]) => ({ hash, count }));
}

/**
 * Get anonymized records after suppression.
 * blacklistedHashes: set of hashed QI keys that were globally suppressed.
 */
function getAnonymizedRecords(ageLevel, zipLevel, blacklistedHashes) {
  const blacklist = new Set(blacklistedHashes);
  const patients  = getAllPatients();

  return patients
    .map(p => {
      const ageGen = ageLevel === 0 ? String(p.age)
        : ageLevel === 1 ? `${Math.floor(p.age / 10) * 10}-${Math.floor(p.age / 10) * 10 + 9}`
        : ageLevel === 2 ? `${Math.floor(p.age / 20) * 20}-${Math.floor(p.age / 20) * 20 + 19}`
        : '*';
      const zipGen = generalizeZipcode(p.zipcode, zipLevel);
      const h      = hashQI(ageGen, p.gender, zipGen);
      return { id: p.id, age_gen: ageGen, gender: p.gender, zip_gen: zipGen, disease: p.disease, _hash: h };
    })
    .filter(r => !blacklist.has(r._hash))
    .map(r => { const { _hash, ...rest } = r; return rest; });
}

module.exports = {
  initDatabase,
  getAllPatients,
  getQIGroups,
  getGeneralizedPatients,
  generalizeAge,
  generalizeZipcode,
  hashQI,
  getHashedQIGroups,
  getAnonymizedRecords,
};
