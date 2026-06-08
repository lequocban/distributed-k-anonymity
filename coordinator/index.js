const express = require('express');
const axios   = require('axios');
const path    = require('path');
const {
  applyGeneralization,
  checkKAnonymity,
  findBestLevel,
  computeAgeDomain,
} = require('./kanonymity');

const app  = express();
const PORT = Number(process.env.PORT) || 3000;
const K    = 5;

const NODES = {
  A: 'http://localhost:3001',
  B: 'http://localhost:3002',
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

async function fetchFromNode(nodeUrl, endpoint) {
  try {
    const res = await axios.get(`${nodeUrl}${endpoint}`, { timeout: 5000 });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: `${nodeUrl} unreachable: ${err.message}` };
  }
}

app.get('/health', async (req, res) => {
  const results = {};
  for (const [name, url] of Object.entries(NODES)) {
    const r = await fetchFromNode(url, '/health');
    results[`Node ${name}`] = r.ok ? 'online' : `offline — ${r.error}`;
  }
  res.json({ coordinator: 'online', nodes: results });
});

app.get('/run', async (req, res) => {
  const parsedK = parseK(req.query.k);
  if (!parsedK.ok) {
    return res.status(400).json({ error: parsedK.error });
  }

  const k = parsedK.value;
  console.log(`\n> Running k-anonymity with k=${k}...`);

  const fetchResults = await Promise.all(
    Object.entries(NODES).map(async ([name, url]) => {
      const r = await fetchFromNode(url, '/patients');
      return { name, ...r };
    })
  );

  const failedNodes = fetchResults.filter(r => !r.ok);
  if (failedNodes.length > 0) {
    const msg = failedNodes.map(n => `Node ${n.name}: ${n.error}`).join('; ');
    console.error(`! Node unreachable: ${msg}`);
    return res.status(503).json({
      error: 'k-anonymity cannot be guaranteed — one or more nodes are unreachable',
      details: msg,
    });
  }

  const allRecords = fetchResults.map(r => ({
    node: r.name,
    records: r.data.data.map(rec => ({ ...rec, _node: r.name })),
  }));

  const mergedAll = allRecords[0].records.concat(allRecords[1].records);
  console.log(`  Total records: ${mergedAll.length} (Node A: ${fetchResults[0].data.count}, Node B: ${fetchResults[1].data.count})`);

  const ageDomain = computeAgeDomain(mergedAll);
  const { level, eval: evalResult } = findBestLevel(mergedAll, k, ageDomain);

  if (!level) {
    return res.status(422).json({
      error: `Cannot achieve k=${k} anonymity even at maximum generalization level`,
    });
  }

  const response = {
    k,
    status:               evalResult.result.satisfied ? 'achieved' : 'not achieved',
    generalization: {
      age_level:    level.age,
      zip_level:    level.zip,
      description:  level.desc,
    },
    information_loss: {
      overall_il_percent:    `${evalResult.il.ilPercent}%`,
      age: {
        il_cell_percent:    `${evalResult.il.cellILAge}%`,
        il_contribution:    `${evalResult.il.ilAgePercent}%`,
        cells_generalized:  evalResult.il.ageAffected,
        total_cells:        evalResult.il.totalRecords,
      },
      zipcode: {
        il_cell_percent:    `${evalResult.il.cellILZip}%`,
        il_contribution:    `${evalResult.il.ilZipPercent}%`,
        cells_generalized:  evalResult.il.zipAffected,
        total_cells:        evalResult.il.totalRecords,
      },
      suppressed: {
        count:              evalResult.suppressedCount,
        total_records:      evalResult.il.totalRecords,
        il_contribution:    `${((evalResult.suppressedCount / evalResult.il.totalRecords) * 100).toFixed(2)}%`,
        per_node:           evalResult.perNodeSuppressed,
      },
    },
    stats: {
      total_qi_groups: evalResult.result.totalGroups,
      valid_groups:   evalResult.result.validGroups,
      min_group_size: evalResult.result.minGroupSize,
    },
    nodes: fetchResults.map(r => {
      const total = r.data.count;
      const suppressed = evalResult.perNodeSuppressed[r.name] || 0;
      return {
        node:         r.name,
        total:        total,
        kept:         total - suppressed,
        suppressed:   suppressed,
      };
    }),
    anonymized_records: evalResult.generalized.filter(r => !r._suppressed),
    suppressed_records: evalResult.generalized.filter(r => r._suppressed),
  };

  console.log(`  -> level=${level.age}/${level.zip} ("${level.desc}")`);
  console.log(`     Overall IL: ${evalResult.il.ilPercent}%  |  Age IL: ${evalResult.il.cellILAge}%  |  Zip IL: ${evalResult.il.cellILZip}%  |  Suppressed IL: ${evalResult.il.ilSuppressPercent}%  |  Suppressed: ${evalResult.suppressedCount}/${mergedAll.length}`);
  const perNode = evalResult.perNodeSuppressed;
  const nodeALabel = perNode ? `Node A: ${perNode['A'] || 0} | Node B: ${perNode['B'] || 0}` : '';
  if (nodeALabel) console.log(`     Suppressed breakdown — ${nodeALabel}`);

  // Hien thi cac equivalence class (nhom tuong duong theo QI)
  const validRecords = evalResult.generalized.filter(r => !r._suppressed);
  const qiGroups = {};
  for (const r of validRecords) {
    const key = `${r.age_gen}|${r.gender}|${r.zip_gen}`;
    if (!qiGroups[key]) qiGroups[key] = [];
    qiGroups[key].push(r);
  }

  const sortedGroups = Object.entries(qiGroups)
    .map(([key, rows]) => {
      const [age_gen, gender, zip_gen] = key.split('|');
      return { key, age_gen, gender, zip_gen, count: rows.length, rows };
    })
    .sort((a, b) => b.count - a.count);

  const MAX_GROUPS_TO_SHOW = 3;
  const selectedGroups = sortedGroups.slice(0, MAX_GROUPS_TO_SHOW);

  console.log('\n  === Equivalence Classes (cac nhom tuong duong theo QI) ===');
  console.log(`  Cac ban ghi co cung gia tri QI (Age, Gender, ZipCode) duoc gom vao cung mot nhom tuong duong (equivalence class).`);
  console.log(`  Tong so nhom QI hop le (count >= ${k}): ${sortedGroups.length}`);
  console.log(`  Hien thi ${Math.min(MAX_GROUPS_TO_SHOW, selectedGroups.length)} nhom (moi nhom co it nhat ${k} ban ghi):\n`);

  selectedGroups.forEach((group, idx) => {
    console.log(`  [Equivalence Class ${idx + 1}]`);
    console.log(`    QI: Age=${group.age_gen}, Gender=${group.gender}, ZipCode=${group.zip_gen}`);
    console.log(`    So ban ghi trong nhom: ${group.count}`);
    console.log(`    Cac ban ghi:`);
    group.rows.forEach((rec, i) => {
      const nodeLabel = rec._node === 'A' ? 'Node A' : 'Node B';
      console.log(`      ${i + 1}. [${nodeLabel}] id=${rec.id}, age=${rec.age_gen}, gender=${rec.gender}, zipcode=${rec.zip_gen}, disease=${rec.disease}`);
    });
    console.log();
  });

  // const N_PER_NODE = 10;
  // const kept = evalResult.generalized.filter(r => !r._suppressed);
  // const sampleA = kept.filter(r => r._node === 'A').slice(0, N_PER_NODE);
  // const sampleB = kept.filter(r => r._node === 'B').slice(0, N_PER_NODE);
  // const sampleSup = evalResult.generalized.filter(r => r._suppressed).slice(0, 4);

  // console.log('\n  === Anonymized records ===');
  // for (const [node, sample] of [['Node A', sampleA], ['Node B', sampleB]]) {
  //   console.log(`\n  [${node}] Valid records (k >= ${k}):`);
  //   sample.forEach(r => {
  //     console.log(`    age=${r.age_gen}  gender=${r.gender}  zipcode=${r.zip_gen}  disease=${r.disease}`);
  //   });
  //   if (sample.length < N_PER_NODE) {
  //     console.log(`    (only ${sample.length} valid records from this node)`);
  //   }
  // }

  // if (sampleSup.length > 0) {
  //   console.log(`\n  [SUPPRESSED] Records removed (group size < ${k}):`);
  //   sampleSup.forEach(r => {
  //     console.log(`    age=${r.age_gen}  gender=${r.gender}  zipcode=${r.zip_gen}  disease=${r.disease}  [from ${r._node}]`);
  //   });
  //   if (evalResult.suppressedCount > 4) {
  //     console.log(`    ... +${evalResult.suppressedCount - 4} more suppressed records`);
  //   }
  // }

  res.json(response);
});

app.get('/run-levels', async (req, res) => {
  const fetchResults = await Promise.all(
    Object.entries(NODES).map(async ([name, url]) => {
      const r = await fetchFromNode(url, '/patients');
      return { name, ...r };
    })
  );

  const failedNodes = fetchResults.filter(r => !r.ok);
  if (failedNodes.length > 0) {
    return res.status(503).json({ error: 'One or more nodes unreachable' });
  }

  const mergedAll = fetchResults[0].data.data.map((rec, i) => ({ ...rec, _node: 'A' }))
    .concat(fetchResults[1].data.data.map(rec => ({ ...rec, _node: 'B' })));
  const ageDomain = computeAgeDomain(mergedAll);
  const comparison  = [];

  for (const k of [5, 10, 20, 50, 150, 250, 350, 500, 700]) {
    const { level, eval: evalResult } = findBestLevel(mergedAll, k, ageDomain);
    comparison.push({
      k,
      age_level:   level ? level.age : null,
      zip_level:   level ? level.zip : null,
      description: level ? level.desc : 'impossible',
      information_loss_percent: evalResult ? evalResult.il.ilPercent : null,
      information_loss_age_percent: evalResult ? evalResult.il.ilAgePercent : null,
      information_loss_zip_percent: evalResult ? evalResult.il.ilZipPercent : null,
      suppressed:  evalResult ? evalResult.suppressedCount : null,
      suppressed_per_node: evalResult ? evalResult.perNodeSuppressed : null,
      total_valid: evalResult ? evalResult.keptCount : null,
      achieved:   !!level,
    });
  }

  res.json({ total_records: mergedAll.length, comparison });
});

app.listen(PORT, () => {
  console.log(`Coordinator running on http://localhost:${PORT}`);
  console.log(`  GET /              -- open web dashboard`);
  console.log(`  GET /health       -- check node status`);
  console.log(`  GET /run          -- run k-anonymity (default k=5)`);
  console.log(`  GET /run?k=7     -- run with custom k`);
  console.log(`  GET /run-levels   -- compare IL across k values`);
});
