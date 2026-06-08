const initSqlJs = require('sql.js');
const fs       = require('fs');
const path     = require('path');

const DB_A = path.join(__dirname, '..', 'node-a', 'site_a.db');
const DB_B = path.join(__dirname, '..', 'node-b', 'site_b.db');

async function main() {
  const SQL = await initSqlJs();

  function createAndSeed(dbPath, zipPrefix) {
    const db = new SQL.Database();

    db.run(`
      CREATE TABLE IF NOT EXISTS patients (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        age     INTEGER NOT NULL,
        gender  TEXT NOT NULL,
        zipcode TEXT NOT NULL,
        disease TEXT NOT NULL
      )
    `);

    const diseases = ['Diabetes', 'Hypertension', 'Asthma', 'Cancer', 'Flu'];

    for (let i = 0; i < 200; i++) {
      const age     = 20 + Math.floor(i / 5);
      const gender  = (i % 5) < 3 ? 'M' : 'F';
      const zipcode = zipPrefix + String(i).padStart(4, '0');
      for (const disease of diseases) {
        db.run(
          'INSERT INTO patients (age, gender, zipcode, disease) VALUES (?, ?, ?, ?)',
          [age, gender, zipcode, disease]
        );
      }
    }

    const buf = db.export();
    fs.writeFileSync(dbPath, Buffer.from(buf));

    const count = db.exec('SELECT COUNT(*) as cnt FROM patients')[0].values[0][0];
    db.close();
    console.log(`Seeded ${count} records -> ${dbPath}`);
    return count;
  }

  console.log('Generating datasets...');
  console.log('  Site A (HCM): zipcode 70000-70199');
  console.log('  Site B (HN):  zipcode 10000-10199');

  const cntA = createAndSeed(DB_A, '7');
  const cntB = createAndSeed(DB_B, '1');

  console.log(`Total: ${cntA + cntB} records (A=${cntA}, B=${cntB})`);
  console.log('Dataset generation complete!');
}

main().catch(console.error);
