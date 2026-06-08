const axios = require('axios');

const BASE = 'http://localhost:3000';

async function testEndpoint(url, label) {
  try {
    const res = await axios.get(url, { timeout: 60000 });
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(res.data, null, 2));
    return res.data;
  } catch (err) {
    console.error(`\n=== ${label} FAILED ===`);
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
    return null;
  }
}

async function main() {
  console.log('=== Distributed k-Anonymity Test Suite ===');

  // Test 1: Health check
  await testEndpoint(`${BASE}/health`, 'HEALTH CHECK');

  // Test 2: Run k-anonymity (k=5)
  await testEndpoint(`${BASE}/run?k=5`, 'RUN k=5');

  // Test 3: Run k-anonymity (k=3)
  await testEndpoint(`${BASE}/run?k=3`, 'RUN k=3');

  // Test 4: Run k-anonymity (k=10)
  await testEndpoint(`${BASE}/run?k=10`, 'RUN k=10');

  // Test 5: Run k-anonymity (k=20)
  await testEndpoint(`${BASE}/run?k=20`, 'RUN k=20');

  // Test 6: Compare levels
  await testEndpoint(`${BASE}/run-levels`, 'RUN LEVELS COMPARISON');

  console.log('\n=== All tests completed ===');
}

main().catch(console.error);
