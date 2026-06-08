const axios = require('axios');

const BASE = 'http://localhost:3000';

async function testRun(k) {
  try {
    const res = await axios.get(`${BASE}/run?k=${k}`, { timeout: 120000 });
    const d = res.data;
    return {
      k,
      status: d.status,
      age_level: d.generalization.age_level,
      zip_level: d.generalization.zip_level,
      desc: d.generalization.description,
      il_total: d.information_loss.overall_il_percent,
      il_age_cell: d.information_loss.age.il_cell_percent,
      il_age_contrib: d.information_loss.age.il_contribution,
      il_zip_cell: d.information_loss.zipcode.il_cell_percent,
      il_zip_contrib: d.information_loss.zipcode.il_contribution,
      suppressed: d.information_loss.suppressed.count,
      total_records: d.information_loss.suppressed.total_records,
      total_groups: d.stats.total_qi_groups,
      valid_groups: d.stats.valid_groups,
      min_group_size: d.stats.min_group_size,
      nodeA_total: d.nodes[0].total,
      nodeA_kept: d.nodes[0].kept,
      nodeB_total: d.nodes[1].total,
      nodeB_kept: d.nodes[1].kept,
    };
  } catch (err) {
    if (err.response) {
      return { k, error: err.response.data.error, details: err.response.data.details };
    }
    return { k, error: err.message };
  }
}

async function testLevels() {
  try {
    const res = await axios.get(`${BASE}/run-levels`, { timeout: 120000 });
    return res.data;
  } catch (err) {
    if (err.response) return err.response.data;
    return { error: err.message };
  }
}

async function testHealth() {
  try {
    const res = await axios.get(`${BASE}/health`, { timeout: 10000 });
    return res.data;
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  console.log('=== Distributed k-Anonymity Test Suite ===\n');

  // Health
  const health = await testHealth();
  console.log('HEALTH CHECK:', JSON.stringify(health));

  // Run levels comparison
  console.log('\n--- RUN LEVELS COMPARISON ---');
  const levels = await testLevels();
  console.log(JSON.stringify(levels, null, 2));

  // Individual k runs
  for (const k of [3, 5, 7, 10, 20]) {
    console.log(`\n--- RUN k=${k} ---`);
    const result = await testRun(k);
    console.log(JSON.stringify(result, null, 2));
  }

  console.log('\n=== All tests completed ===');
}

main().catch(console.error);
