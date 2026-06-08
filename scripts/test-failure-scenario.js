const { spawn, execSync } = require('child_process');
const axios = require('axios');

const BASE = 'http://localhost:3000';
const NODE_B_PID_FILE = __dirname + '/node_b.pid';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getNodePid(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && pid !== 'LISTENING') {
        return parseInt(pid);
      }
    }
  } catch (e) { }
  return null;
}

async function testHealth() {
  try {
    const res = await axios.get(`${BASE}/health`, { timeout: 10000 });
    return res.data;
  } catch (err) {
    return err.response ? err.response.data : { error: err.message };
  }
}

async function testRun(k) {
  try {
    const res = await axios.get(`${BASE}/run?k=${k}`, { timeout: 15000 });
    return { success: true, status: res.status, data: res.data };
  } catch (err) {
    return {
      success: false,
      status: err.response ? err.response.status : 0,
      error: err.response ? err.response.data.error : err.message,
      details: err.response ? err.response.data.details : null,
    };
  }
}

async function main() {
  console.log('=== Failure Scenario Test: Node B Failure ===\n');

  // Step 1: Verify both nodes are online
  console.log('--- STEP 1: Health check (both nodes online) ---');
  const healthBefore = await testHealth();
  console.log(JSON.stringify(healthBefore, null, 2));

  // Step 2: Run k-anonymity with both nodes online
  console.log('\n--- STEP 2: Run k-anonymity (k=5) with both nodes online ---');
  const runBefore = await testRun(5);
  console.log(JSON.stringify(runBefore, null, 2));

  // Step 3: Kill Node B
  const nodeBPid = getNodePid(3002);
  console.log(`\n--- STEP 3: Killing Node B (PID: ${nodeBPid}) ---`);
  if (nodeBPid) {
    try {
      process.kill(nodeBPid, 'SIGTERM');
      console.log('Node B killed (SIGTERM sent)');
    } catch (e) {
      console.log('Failed to kill Node B:', e.message);
    }
  } else {
    console.log('Could not find Node B PID');
  }
  await sleep(2000);

  // Step 4: Health check with Node B down
  console.log('\n--- STEP 4: Health check (Node B down) ---');
  const healthAfterKill = await testHealth();
  console.log(JSON.stringify(healthAfterKill, null, 2));

  // Step 5: Try to run k-anonymity with Node B down
  console.log('\n--- STEP 5: Run k-anonymity (k=5) with Node B down (EXPECTED: HTTP 503) ---');
  const runAfterKill = await testRun(5);
  console.log(JSON.stringify(runAfterKill, null, 2));

  // Step 6: Restart Node B
  console.log('\n--- STEP 6: Restarting Node B ---');
  const nodeB = spawn('node', ['node-b/index.js'], {
    cwd: __dirname + '/..',
    detached: true,
    stdio: 'ignore',
  });
  nodeB.unref();
  console.log('Node B restart initiated (PID: ' + nodeB.pid + ')');
  await sleep(4000);

  // Step 7: Health check after restart
  console.log('\n--- STEP 7: Health check (Node B restarted) ---');
  const healthAfterRestart = await testHealth();
  console.log(JSON.stringify(healthAfterRestart, null, 2));

  // Step 8: Run k-anonymity again
  console.log('\n--- STEP 8: Run k-anonymity (k=5) after Node B restart ---');
  const runAfterRestart = await testRun(5);
  console.log(JSON.stringify(runAfterRestart, null, 2));

  console.log('\n=== Failure Scenario Test Complete ===');
}

main().catch(console.error);
