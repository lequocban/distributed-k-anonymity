/**
 * Distributed k-Anonymity Algorithm — Coordinator
 *
 * Information Loss Formula (mixed approach):
 *
 * 1. Age (Arithmetic Attribute) — Generalized Information Loss (GIL):
 *    IL_age = (Uij - Lij) / (Ui - Li)
 *    - Ui = max age in dataset, Li = min age in dataset
 *    - Lij, Uij = bounds of the generalized interval
 *
 * 2. Zipcode (Hierarchy-based / Precision Metric):
 *    IL_zip = current_level / max_level
 *    - Level 0: exact 5-digit (IL=0/4=0%)
 *    - Level 1: hide 1 digit  (IL=1/4=25%)
 *    - Level 2: hide 2 digits (IL=2/4=50%)
 *    - Level 3: hide 3 digits (IL=3/4=75%)
 *    - Level 4: hide 4+ digits → ***** (IL=4/4=100%)
 *
 * 3. Suppressed records:
 *    IL_sup = (suppressed_count / total_count)
 *
 * 4. Overall IL = (IL_age + IL_zip + IL_sup) / 3 * 100%
 */

const ZIP_MAX_LEVEL = 4;

// Age domain computed dynamically from data
function computeAgeDomain(records) {
  if (!records || records.length === 0) return { min: 0, max: 0, width: 0 };
  const ages = records.map(r => r.age).filter(a => a !== undefined && a !== null);
  const min = Math.min(...ages);
  const max = Math.max(...ages);
  return { min, max, width: max - min };
}

function generalizeAge(age, level) {
  if (level === 0) return { label: String(age), l: age, u: age };
  if (level === 1) {
    const base = Math.floor(age / 10) * 10;
    return { label: `${base}-${base + 9}`, l: base, u: base + 9 };
  }
  if (level === 2) {
    const base = Math.floor(age / 20) * 20;
    return { label: `${base}-${base + 19}`, l: base, u: base + 19 };
  }
  return { label: '*', l: null, u: null };
}

function generalizeZipcode(zipcode, level) {
  const z = String(zipcode);
  if (level === 0) return z;
  if (level === 1) return `${z.slice(0, -1)}*`;
  if (level === 2) return `${z.slice(0, -2)}**`;
  if (level === 3) return `${z.slice(0, -3)}***`;
  if (level === 4) return '*****';
  return '*****';
}

function applyGeneralization(records, ageLevel, zipLevel) {
  return records.map(r => {
    const ageGen = generalizeAge(r.age, ageLevel);
    return {
      ...r,
      age_gen:  ageGen.label,
      age_l:    ageGen.l,
      age_u:    ageGen.u,
      zip_gen:  generalizeZipcode(String(r.zipcode), zipLevel),
    };
  });
}

function partitionByQI(records) {
  const groups = {};
  for (const r of records) {
    const key = `${r.age_gen}|${r.gender}|${r.zip_gen}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

function checkKAnonymity(records, k = 5) {
  const groups = partitionByQI(records);
  const groupInfos = Object.entries(groups).map(([key, rows]) => {
    const [age_gen, gender, zip_gen] = key.split('|');
    return { key, age_gen, gender, zip_gen, count: rows.length, rows };
  });

  const violating = groupInfos.filter(g => g.count < k);
  const valid     = groupInfos.filter(g => g.count >= k);

  const minGroupSize = valid.length > 0
    ? Math.min(...valid.map(g => g.count))
    : 0;

  return {
    satisfied:       violating.length === 0,
    totalGroups:     groupInfos.length,
    validGroups:    valid.length,
    violatingGroups: violating,
    minGroupSize,
  };
}

function calculateInformationLoss(records, ageLevel, zipLevel, suppressedCount, ageDomain) {
  const total = records.length;
  if (total === 0) {
    return {
      ilPercent: 0,
      ilAgePercent: 0,
      ilZipPercent: 0,
      ilSuppressPercent: 0,
      ageAffected: 0,
      zipAffected: 0,
      suppressed: 0,
      totalRecords: 0,
      cellILAge: 0,
      cellILZip: 0,
    };
  }

  const { min, max, width } = ageDomain;

  // --- Age IL (GIL per cell) ---
  // IL_cell_age = (Uij - Lij) / (Ui - Li)
  let ageIntervalWidth = 0;
  if (ageLevel === 0) {
    // exact: interval = 1 (the single value)
    ageIntervalWidth = 1;
  } else if (ageLevel === 1) {
    // 10-year range
    ageIntervalWidth = 10;
  } else if (ageLevel === 2) {
    // 20-year range
    ageIntervalWidth = 20;
  } else {
    // suppressed: full domain width
    ageIntervalWidth = width;
  }

  const cellILAge = width > 0 ? ageIntervalWidth / width : 0;

  // --- Zip IL (Precision Metric: current_level / max_level) ---
  const cellILZip = zipLevel / ZIP_MAX_LEVEL;

  // Tất cả records đều bị generalize (nếu level > 0)
  const ageAffected = ageLevel > 0 ? total : 0;
  const zipAffected  = zipLevel  > 0 ? total : 0;

  const ageRatio = ageAffected / total;
  const zipRatio = zipAffected  / total;
  const supRatio = suppressedCount / total;

  const ilAge  = cellILAge * ageRatio;
  const ilZip  = cellILZip  * zipRatio;
  const ilSup  = 1.0        * supRatio;

  // Overall IL: trung bình 3 thành phần, ×100
  const ilPercent = ((ilAge + ilZip + ilSup) / 3 * 100);

  return {
    ilPercent:         parseFloat(ilPercent.toFixed(4)),
    ilAgePercent:      parseFloat((ilAge * 100).toFixed(4)),
    ilZipPercent:      parseFloat((ilZip * 100).toFixed(4)),
    ilSuppressPercent: parseFloat((ilSup * 100).toFixed(4)),
    ageAffected,
    zipAffected,
    suppressed:       suppressedCount,
    totalRecords:     total,
    cellILAge:        parseFloat((cellILAge * 100).toFixed(4)),
    cellILZip:        parseFloat((cellILZip * 100).toFixed(4)),
  };
}

const AGE_LEVEL_DESCRIPTIONS = [
  'exact',
  '10-year range',
  '20-year range',
  '*',
];

const ZIP_LEVEL_DESCRIPTIONS = [
  'exact 5-digit',
  '4-digit prefix',
  '3-digit prefix',
  '2-digit prefix',
  '*',
];

const LEVELS = [];
for (let age = 0; age <= 3; age++) {
  for (let zip = 0; zip <= ZIP_MAX_LEVEL; zip++) {
    LEVELS.push({
      age,
      zip,
      desc: age === 0 && zip === 0
        ? 'Original (no generalization)'
        : `Age: ${AGE_LEVEL_DESCRIPTIONS[age]} | ZipCode: ${ZIP_LEVEL_DESCRIPTIONS[zip]}`,
    });
  }
}

function getPerNodeSuppressedCount(records) {
  const result = {};
  for (const r of records) {
    if (r._suppressed) {
      result[r._node] = (result[r._node] || 0) + 1;
    }
  }
  return result;
}

function evaluateLevel(allRecords, ageLevel, zipLevel, k, ageDomain) {
  const generalized = applyGeneralization(allRecords, ageLevel, zipLevel);
  const beforeSuppression = checkKAnonymity(generalized, k);

  const suppressedCount = beforeSuppression.violatingGroups.reduce(
    (sum, g) => sum + g.count, 0
  );
  const violatingKeys = new Set(beforeSuppression.violatingGroups.map(g => g.key));
  const kept = generalized.filter(r => {
    const key = `${r.age_gen}|${r.gender}|${r.zip_gen}`;
    return !violatingKeys.has(key);
  });
  const result = checkKAnonymity(kept, k);

  const marked = generalized.map(r => ({
    ...r,
    _suppressed: violatingKeys.has(`${r.age_gen}|${r.gender}|${r.zip_gen}`),
  }));

  const il = calculateInformationLoss(allRecords, ageLevel, zipLevel, suppressedCount, ageDomain);
  const perNodeSuppressed = getPerNodeSuppressedCount(marked);

  return {
    ageLevel,
    zipLevel,
    result,
    beforeSuppression,
    suppressedCount,
    perNodeSuppressed,
    keptCount:    kept.length,
    kept,
    generalized:  marked,
    il,
  };
}

function findBestLevel(allRecords, k = 5, ageDomain = null) {
  const domain = ageDomain || computeAgeDomain(allRecords);

  let best = null;

  for (const lvl of LEVELS) {
    const eval_ = evaluateLevel(allRecords, lvl.age, lvl.zip, k, domain);

    if (eval_.keptCount > 0 && eval_.result.satisfied) {
      const hasLowerIL = !best || eval_.il.ilPercent < best.eval.il.ilPercent;
      const hasEqualIL = best && eval_.il.ilPercent === best.eval.il.ilPercent;
      const hasLessSuppression = hasEqualIL &&
        eval_.suppressedCount < best.eval.suppressedCount;
      const hasLowerLevel = hasEqualIL &&
        eval_.suppressedCount === best.eval.suppressedCount &&
        (lvl.age + lvl.zip) < (best.level.age + best.level.zip);

      if (hasLowerIL || hasLessSuppression || hasLowerLevel) {
        best = { level: lvl, eval: eval_ };
      }
    }
  }
  return best || { level: null, eval: null };
}

module.exports = {
  generalizeAge,
  generalizeZipcode,
  applyGeneralization,
  checkKAnonymity,
  calculateInformationLoss,
  evaluateLevel,
  findBestLevel,
  computeAgeDomain,
  LEVELS,
  ZIP_MAX_LEVEL,
};
