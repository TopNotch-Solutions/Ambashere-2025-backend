const sequelize = require("../config/database");
const Staff = require("../models/Staff");

function normalizeEmployeeCode(employeeCode) {
  return String(employeeCode || "")
    .trim()
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

function normalizedEmployeeCodeWhere(columnName, employeeCode) {
  return sequelize.where(
    sequelize.fn(
      "REPLACE",
      sequelize.fn(
        "REPLACE",
        sequelize.fn("UPPER", sequelize.col(columnName)),
        "-",
        ""
      ),
      " ",
      ""
    ),
    normalizeEmployeeCode(employeeCode)
  );
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
  normalizedEmployeeCodeWhere,
  findStaffByEmployeeCode,
  resolveEmployeeCodeFromCdrLive,
};
