const assert = require('assert');
const {
  LEVELS,
  computeAgeDomain,
  findBestLevel,
} = require('../coordinator/kanonymity');

function patient(age, gender, zipcode, node = 'A') {
  return { age, gender, zipcode, disease: 'Test', _node: node };
}

function testAllGeneralizationCombinations() {
  assert.strictEqual(LEVELS.length, 20);
  assert.strictEqual(
    new Set(LEVELS.map(level => `${level.age}/${level.zip}`)).size,
    20
  );
  assert(LEVELS.some(level => level.age === 0 && level.zip === 4));
  assert(LEVELS.some(level => level.age === 2 && level.zip === 0));
}

function testSuppressionCanProduceValidResult() {
  const records = [
    patient(20, 'M', '10000'),
    patient(20, 'M', '10000'),
    patient(20, 'M', '10000'),
    patient(20, 'F', '10000', 'B'),
    patient(20, 'F', '10000', 'B'),
  ];

  const best = findBestLevel(records, 3, computeAgeDomain(records));

  assert(best.level);
  assert.strictEqual(best.level.age, 0);
  assert.strictEqual(best.level.zip, 0);
  assert.strictEqual(best.eval.keptCount, 3);
  assert.strictEqual(best.eval.suppressedCount, 2);
  assert.strictEqual(best.eval.result.satisfied, true);
}

function testSuppressingEverythingIsNotAValidResult() {
  const records = [
    patient(20, 'M', '10000'),
    patient(30, 'F', '20000', 'B'),
  ];

  const best = findBestLevel(records, 3, computeAgeDomain(records));
  assert.strictEqual(best.level, null);
  assert.strictEqual(best.eval, null);
}

testAllGeneralizationCombinations();
testSuppressionCanProduceValidResult();
testSuppressingEverythingIsNotAValidResult();

console.log('Basic regression tests passed');
