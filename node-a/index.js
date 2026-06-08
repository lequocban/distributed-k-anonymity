const express = require('express');
const { initDatabase, getAllPatients, getQIGroups, getGeneralizedPatients } = require('./database');

const app  = express();
const PORT = 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', node: 'A', port: PORT });
});

app.get('/patients', (req, res) => {
  const patients = getAllPatients();
  res.json({ node: 'A', count: patients.length, data: patients });
});

app.get('/qi-groups', (req, res) => {
  const groups = getQIGroups();
  res.json({ node: 'A', groups });
});

app.get('/generalized', (req, res) => {
  const level    = parseInt(req.query.level) || 1;
  const patients = getGeneralizedPatients(level);
  res.json({ node: 'A', level, count: patients.length, data: patients });
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Node A running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
