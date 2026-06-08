const initSqlJs = require('sql.js');
const fs       = require('fs');
const path     = require('path');

const DB_PATH = path.join(__dirname, 'site_a.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf  = fs.readFileSync(DB_PATH);
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

module.exports = { initDatabase, getAllPatients, getQIGroups, getGeneralizedPatients, generalizeAge };
