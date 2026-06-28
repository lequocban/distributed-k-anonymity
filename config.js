/**
 * Shared config — loads environment variables.
 * Both Node A, Node B, and Coordinator use this
 * to agree on the shared API token.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const NODE_API_TOKEN = process.env.NODE_API_TOKEN;

if (!NODE_API_TOKEN) {
  console.error('[config] ERROR: NODE_API_TOKEN is not set in .env');
  process.exit(1);
}

module.exports = { NODE_API_TOKEN };
