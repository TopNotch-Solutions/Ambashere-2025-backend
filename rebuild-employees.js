/**
 * Rebuild employees from:
 * - crdlive_employee_detail (identity / contact)
 * - new_employee_list (department / title / start date)
 * - master_details (status / payment / allowance → category & allocation)
 */
require("dotenv").config();
const sequelize = require("./config/database");

function normalizeEmployeeCode(employeeCode) {
  return String(employeeCode || "")
    .trim()
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

function mapGender(gender) {
  if (!gender) return null;
  const value = String(gender).trim().toUpperCase();
  if (value.startsWith("F")) return "Female";
  if (value.startsWith("M")) return "Male";
  return null;
}

function parseAllowance(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[,\s]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function mapAllowance(allowance) {
  // Permanent tiers
  if (allowance === 2200) return { AllocationID: 1, EmploymentCategory: "Permanent" };
  if (allowance === 3300) return { AllocationID: 2, EmploymentCategory: "Permanent" };
  if (allowance === 4400) return { AllocationID: 3, EmploymentCategory: "Permanent" };
  if (allowance === 8000) return { AllocationID: 4, EmploymentCategory: "Permanent" };
  // Retiree
  if (allowance === 500) return { AllocationID: 6, EmploymentCategory: "Retired" };
  // Everyone else (null, 5000, empty, etc.) → Temporary
  return { AllocationID: 5, EmploymentCategory: "Temporary" };
}

function mapServicePlan(paymentType) {
  if (!paymentType) return "PrePaid";
  const value = String(paymentType).trim().toLowerCase();
  if (value.includes("post")) return "PostPaid";
  return "PrePaid";
}

function parseDateEngaged(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  // Prefer YYYY/MM/DD or YYYY-MM-DD
  const slash = value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (slash) {
    const d = new Date(Number(slash[1]), Number(slash[2]) - 1, Number(slash[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pickPreferredEmployeeCode(...codes) {
  const candidates = codes
    .map((c) => (c == null ? null : String(c).trim()))
    .filter(Boolean);
  if (!candidates.length) return null;
  // Prefer hyphenated form when available (historical canonical style)
  const hyphenated = candidates.find((c) => c.includes("-"));
  return (hyphenated || candidates[0]).toUpperCase();
}

(async () => {
  console.log("Loading source tables...");

  const [cdrRows] = await sequelize.query(`
    SELECT msisdn, employee_code, full_names, last_name, email, gender, username
    FROM crdlive_employee_detail
  `);
  const [nelRows] = await sequelize.query(`
    SELECT EmployeeCode, FirstName, LastName, department, title, DisplayName, DateEngaged
    FROM new_employee_list
  `);
  const [mdRows] = await sequelize.query(`
    SELECT employee_code, status, payment_type, total_airtime_allowance
    FROM master_details
  `);
  const [existingRows] = await sequelize.query(`
    SELECT EmployeeCode, RoleID, ProfileImage
    FROM employees
  `);

  console.log(
    `Loaded CDR=${cdrRows.length}, NEL=${nelRows.length}, master=${mdRows.length}, existing=${existingRows.length}`
  );

  const cdrByCode = new Map();
  for (const row of cdrRows) {
    const key = normalizeEmployeeCode(row.employee_code);
    if (!key) continue;
    if (!cdrByCode.has(key)) cdrByCode.set(key, row);
  }

  const nelByCode = new Map();
  for (const row of nelRows) {
    const key = normalizeEmployeeCode(row.EmployeeCode);
    if (!key) continue;
    if (!nelByCode.has(key)) nelByCode.set(key, row);
  }

  const mdByCode = new Map();
  for (const row of mdRows) {
    const key = normalizeEmployeeCode(row.employee_code);
    if (!key) continue;
    if (!mdByCode.has(key)) mdByCode.set(key, row);
  }

  const existingByCode = new Map();
  for (const row of existingRows) {
    const key = normalizeEmployeeCode(row.EmployeeCode);
    if (!key) continue;
    if (!existingByCode.has(key)) existingByCode.set(key, row);
  }

  const allCodes = new Set([
    ...cdrByCode.keys(),
    ...nelByCode.keys(),
    ...mdByCode.keys(),
  ]);

  const employees = [];
  const skipped = [];

  for (const key of allCodes) {
    const cdr = cdrByCode.get(key);
    const nel = nelByCode.get(key);
    const md = mdByCode.get(key);
    const existing = existingByCode.get(key);

    const employeeCode = pickPreferredEmployeeCode(
      existing?.EmployeeCode,
      nel?.EmployeeCode,
      md?.employee_code,
      cdr?.employee_code
    );

    const firstName =
      (cdr?.full_names && String(cdr.full_names).trim()) ||
      (nel?.FirstName && String(nel.FirstName).trim()) ||
      null;
    const lastName =
      (cdr?.last_name && String(cdr.last_name).trim()) ||
      (nel?.LastName && String(nel.LastName).trim()) ||
      null;

    if (!employeeCode || !firstName || !lastName) {
      skipped.push({
        key,
        reason: "Missing EmployeeCode, FirstName, or LastName",
        hasCdr: !!cdr,
        hasNel: !!nel,
        hasMd: !!md,
      });
      continue;
    }

    const fullName =
      (nel?.DisplayName && String(nel.DisplayName).trim()) ||
      `${firstName} ${lastName}`.trim();

    const email =
      (cdr?.email && String(cdr.email).trim()) ||
      `noemail_${key.toLowerCase()}@mtc.com.na`;

    const phoneNumber =
      (cdr?.msisdn && String(cdr.msisdn).trim()) || "81";

    const gender = mapGender(cdr?.gender) || "Male";

    const department =
      (nel?.department && String(nel.department).trim()) || "Not Specified";
    const position =
      (nel?.title && String(nel.title).trim()) || "Not Specified";

    const allowance = parseAllowance(md?.total_airtime_allowance);
    const { AllocationID, EmploymentCategory } = mapAllowance(allowance);

    const employmentStatus =
      md?.status === "Inactive" || md?.status === "Active"
        ? md.status
        : "Active";

    const servicePlan = mapServicePlan(md?.payment_type);
    const employmentStartDate = parseDateEngaged(nel?.DateEngaged);

    const roleId = existing?.RoleID || 3;

    employees.push({
      EmployeeCode: employeeCode,
      RoleID: String(roleId),
      AllocationID: String(AllocationID),
      FirstName: firstName,
      LastName: lastName,
      FullName: fullName,
      Email: email,
      PhoneNumber: phoneNumber,
      Gender: gender,
      ServicePlan: servicePlan,
      Position: position,
      Department: department,
      Division: department,
      EmploymentCategory,
      EmploymentStatus: employmentStatus,
      EmploymentStartDate: employmentStartDate,
      ProfileImage: existing?.ProfileImage ?? null,
      _meta: { key, allowance, hasCdr: !!cdr, hasNel: !!nel, hasMd: !!md },
    });
  }

  console.log(`Prepared ${employees.length} employees, skipped ${skipped.length}`);

  // Deduplicate by final EmployeeCode (hyphen variants can collide)
  const byFinalCode = new Map();
  const duplicateFinalCodes = [];
  for (const emp of employees) {
    if (byFinalCode.has(emp.EmployeeCode)) {
      duplicateFinalCodes.push(emp.EmployeeCode);
      continue;
    }
    byFinalCode.set(emp.EmployeeCode, emp);
  }
  const uniqueEmployees = [...byFinalCode.values()];
  if (duplicateFinalCodes.length) {
    console.warn(`Dropped ${duplicateFinalCodes.length} duplicate EmployeeCode rows`);
  }

  const t = await sequelize.transaction();
  try {
    console.log("Clearing employees table...");
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction: t });
    await sequelize.query("DELETE FROM employees", { transaction: t });

    console.log(`Inserting ${uniqueEmployees.length} employees...`);
    const batchSize = 100;
    for (let i = 0; i < uniqueEmployees.length; i += batchSize) {
      const batch = uniqueEmployees.slice(i, i + batchSize).map((e) => {
        const { _meta, ...row } = e;
        return row;
      });

      const columns = [
        "EmployeeCode",
        "RoleID",
        "AllocationID",
        "FirstName",
        "LastName",
        "FullName",
        "Email",
        "PhoneNumber",
        "Gender",
        "ServicePlan",
        "Position",
        "Department",
        "Division",
        "EmploymentCategory",
        "EmploymentStatus",
        "EmploymentStartDate",
        "ProfileImage",
      ];

      const placeholders = batch
        .map(() => `(${columns.map(() => "?").join(",")})`)
        .join(",");
      const values = batch.flatMap((row) =>
        columns.map((col) => {
          if (col === "ProfileImage") {
            if (row[col] == null) return null;
            return typeof row[col] === "string" ? row[col] : JSON.stringify(row[col]);
          }
          return row[col];
        })
      );

      await sequelize.query(
        `INSERT INTO employees (${columns.join(",")}) VALUES ${placeholders}`,
        { replacements: values, transaction: t }
      );
      console.log(`  inserted ${Math.min(i + batchSize, uniqueEmployees.length)}/${uniqueEmployees.length}`);
    }

    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  const [counts] = await sequelize.query(`
    SELECT
      COUNT(*) AS total,
      SUM(EmploymentCategory = 'Permanent') AS permanent_count,
      SUM(EmploymentCategory = 'Temporary') AS temporary_count,
      SUM(EmploymentCategory = 'Retired') AS retired_count,
      SUM(AllocationID = '1') AS alloc_1,
      SUM(AllocationID = '2') AS alloc_2,
      SUM(AllocationID = '3') AS alloc_3,
      SUM(AllocationID = '4') AS alloc_4,
      SUM(AllocationID = '5') AS alloc_5,
      SUM(AllocationID = '6') AS alloc_6
    FROM employees
  `);

  console.log("Rebuild complete.");
  console.log(JSON.stringify(counts[0], null, 2));
  console.log(`Skipped: ${skipped.length}`);
  if (skipped.length) {
    console.log("First 20 skipped:", JSON.stringify(skipped.slice(0, 20), null, 2));
  }

  await sequelize.close();
})().catch((e) => {
  console.error("Rebuild failed:", e);
  process.exit(1);
});
