/**
 * Auth middleware — Bearer Token authentication.
 *
 * Validates that every incoming request carries a valid
 * Authorization header in the form:
 *   Authorization: Bearer <NODE_API_TOKEN>
 *
 * Used by Node A and Node B to block unauthorized access
 * to ALL endpoints (including /health).
 */
const path = require('path');
const { NODE_API_TOKEN } = require(path.join(__dirname, 'config'));

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Authorization header. Expected: Authorization: Bearer <token>',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Malformed Authorization header. Expected format: Bearer <token>',
    });
  }

  const token = parts[1];
  if (token !== NODE_API_TOKEN) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API token.',
    });
  }

  next();
}

module.exports = { authMiddleware };
