const sequelize = require("../config/database");
const { Op } = require("sequelize");
const Staff = require("../models/Staff");

function normalizeEmployeeCode(employeeCode) {
  return String(employeeCode || "")
    .trim()
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

/**
 * Known employee-code discrepancies (same person, different codes in
 * staff vs CDR / handset sources). Pairs are bidirectional.
 */
const EMPLOYEE_CODE_ALIAS_PAIRS = [
  ["ENAMU07", "E-NAMU06"],
  ["ENAUN01", "ENAUN02"],
  ["EKATA01", "EKATA02"],
  ["EJOAO01", "EJOAO"],
  ["ENAKA09", "ENAKA11"],
  ["ESHIP08", "ESHIP05"],
  ["EKOOP06", "EKOOP04"],
  ["EKALU01", "EKALU02"],
  ["EFERR01", "EFERR03"],
  ["ENDIK01", "ENDIW01"],
  ["ENAKA04", "ENAKA01"],
  ["EASHI07", "EASHI06"],
  ["EMIGU02", "EMIGU01"],
  ["EHAIL01", "EHAIL03"],
  ["EVAND05", "EVAND04"],
  ["ESHIV09", "ESHIV11"],
  ["EGEUR01", "EGEUR02"],
  ["EJULI01", "EJULI02"],
  ["EHOSE02", "EHOSE01"],
  ["EMAJI03", "EMAJI05"],
  ["ETSHA02", "ETSHA01"],
  ["EMOUT10", "EMOUT08"],
  ["EBAUL02", "EBAUL01"],
  ["EMANG02", "EMUNG02"],
];

function buildEmployeeCodeAliasLookup(pairs) {
  const parent = new Map();

  const find = (code) => {
    if (!parent.has(code)) parent.set(code, code);
    if (parent.get(code) !== code) {
      parent.set(code, find(parent.get(code)));
    }
    return parent.get(code);
  };

  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  pairs.forEach(([left, right]) => {
    const a = normalizeEmployeeCode(left);
    const b = normalizeEmployeeCode(right);
    if (!a || !b) return;
    union(a, b);
  });

  const groups = new Map();
  for (const code of parent.keys()) {
    const root = find(code);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root).add(code);
  }

  const lookup = new Map();
  for (const members of groups.values()) {
    const list = Array.from(members);
    list.forEach((code) => lookup.set(code, list));
  }
  return lookup;
}

const EMPLOYEE_CODE_ALIAS_LOOKUP = buildEmployeeCodeAliasLookup(
  EMPLOYEE_CODE_ALIAS_PAIRS
);

/** All normalized codes that represent the same person (includes the input). */
function expandEmployeeCodeAliases(employeeCode) {
  const normalized = normalizeEmployeeCode(employeeCode);
  if (!normalized) return [];
  const aliases = EMPLOYEE_CODE_ALIAS_LOOKUP.get(normalized);
  return aliases ? [...aliases] : [normalized];
}

function areEmployeeCodesEquivalent(left, right) {
  const a = normalizeEmployeeCode(left);
  const b = normalizeEmployeeCode(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return expandEmployeeCodeAliases(a).includes(b);
}

function normalizedEmployeeCodeExpression(columnName) {
  return sequelize.fn(
    "REPLACE",
    sequelize.fn(
      "REPLACE",
      sequelize.fn("UPPER", sequelize.col(columnName)),
      "-",
      ""
    ),
    " ",
    ""
  );
}

function normalizedEmployeeCodeWhere(columnName, employeeCode) {
  const codes = expandEmployeeCodeAliases(employeeCode);
  const expression = normalizedEmployeeCodeExpression(columnName);
  if (codes.length <= 1) {
    return sequelize.where(expression, codes[0] || "");
  }
  return sequelize.where(expression, { [Op.in]: codes });
}

async function findStaffByEmployeeCode(employeeCode) {
  return Staff.findOne({
    where: normalizedEmployeeCodeWhere("EmployeeCode", employeeCode),
  });
}

/**
 * Maps a CDR Live employee_code (e.g. EWILH05) to the canonical employees.EmployeeCode
 * (e.g. E-WILH05). Returns null when no matching employee exists.
 */
async function resolveEmployeeCodeFromCdrLive(cdrEmployeeCode) {
  const staff = await findStaffByEmployeeCode(cdrEmployeeCode);
  return staff?.EmployeeCode ?? null;
}

module.exports = {
  normalizeEmployeeCode,
  expandEmployeeCodeAliases,
  areEmployeeCodesEquivalent,
  normalizedEmployeeCodeWhere,
  findStaffByEmployeeCode,
  resolveEmployeeCodeFromCdrLive,
  EMPLOYEE_CODE_ALIAS_PAIRS,
};
