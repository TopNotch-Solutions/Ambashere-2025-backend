const HandsetRenewalOverride = require("../models/HandsetRenewalOverride");
const {
  normalizeEmployeeCode,
  findStaffByEmployeeCode,
} = require("./employeeCode");

const STAFF_PORTAL_URL =
  process.env.STAFF_PORTAL_URL ||
  process.env.FRONTEND_URL ||
  "https://ambasphere.mtc.com.na";

function toDateOnlyString(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRenewalDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildHandsetRenewalProductionMessage({
  employeeName,
  renewalDate,
  portalUrl = STAFF_PORTAL_URL,
}) {
  const name = String(employeeName || "").trim() || "there";
  const formattedDate = formatRenewalDateLabel(renewalDate);

  return (
    `Hi ${name},\n\n` +
    `Your past handset benefit record has been reviewed and updated on Ambasphere.\n\n` +
    `Based on your previous handset allocation history, your new handset eligibility date is ${formattedDate}. ` +
    `On or after this date, you will be able to apply for a new staff handset through the benefits portal.\n\n` +
    `Your current device remains yours to keep. You will also receive reminder notifications as your new handset date approaches.\n\n` +
    `Visit the benefits portal: ${portalUrl}`
  );
}

async function upsertHandsetRenewalOverride({
  employeeCode,
  renewalDate,
  reasonMessage,
  eventId,
  createdByAdminCode,
}) {
  const staff = await findStaffByEmployeeCode(employeeCode);
  if (!staff?.EmployeeCode) {
    throw new Error("Selected employee was not found.");
  }

  const dateOnly = toDateOnlyString(renewalDate);
  if (!dateOnly) {
    throw new Error("A valid new handset date is required.");
  }

  const payload = {
    employeeCode: staff.EmployeeCode,
    renewalDate: dateOnly,
    reasonMessage: reasonMessage || null,
    eventId: eventId || null,
    createdByAdminCode: createdByAdminCode || null,
  };

  const existing = await HandsetRenewalOverride.findOne({
    where: { employeeCode: staff.EmployeeCode },
  });

  if (existing) {
    await existing.update(payload);
    return { override: existing, staff };
  }

  const created = await HandsetRenewalOverride.create(payload);
  return { override: created, staff };
}

async function clearHandsetRenewalOverride(employeeCode) {
  const staff = await findStaffByEmployeeCode(employeeCode);
  const normalizedTarget = normalizeEmployeeCode(
    staff?.EmployeeCode || employeeCode
  );
  if (!normalizedTarget) return 0;

  const rows = await HandsetRenewalOverride.findAll();
  let cleared = 0;
  for (const row of rows) {
    if (normalizeEmployeeCode(row.employeeCode) === normalizedTarget) {
      await row.destroy();
      cleared += 1;
    }
  }
  return cleared;
}

async function getHandsetRenewalOverrideMap() {
  const rows = await HandsetRenewalOverride.findAll();
  const map = new Map();
  for (const row of rows) {
    map.set(normalizeEmployeeCode(row.employeeCode), row);
  }
  return map;
}

function isOverrideSupersededByCdr(override, cdrRenewalDate, cdrCollectedDate) {
  if (!override?.renewalDate) return false;

  const overrideDate = toDateOnlyString(override.renewalDate);
  const cdrRenewal = toDateOnlyString(cdrRenewalDate);
  const collected = toDateOnlyString(cdrCollectedDate);
  const overrideUpdated = toDateOnlyString(override.updatedAt || override.createdAt);

  // New CDR renewal cycle after the calendar eligibility date.
  if (cdrRenewal && overrideDate && cdrRenewal > overrideDate) {
    return true;
  }

  // Device collected on/after the calendar eligibility date.
  if (collected && overrideDate && collected >= overrideDate) {
    return true;
  }

  // Device collected after the override was saved.
  if (collected && overrideUpdated && collected > overrideUpdated) {
    return true;
  }

  return false;
}

/**
 * Removes calendar overrides that are obsolete because CDR now reflects a newer handset.
 * `handsets` is the synced CDR payload (or DB rows).
 */
async function clearOverridesSupersededByCdrHandsets(handsets = []) {
  if (!Array.isArray(handsets) || handsets.length === 0) return 0;

  const overrideMap = await getHandsetRenewalOverrideMap();
  if (overrideMap.size === 0) return 0;

  const byEmployee = new Map();
  for (const handset of handsets) {
    const code = normalizeEmployeeCode(
      handset.employee_code || handset.employeeCode || handset.EmployeeCode
    );
    if (!code) continue;
    if (!byEmployee.has(code)) byEmployee.set(code, []);
    byEmployee.get(code).push(handset);
  }

  let cleared = 0;
  for (const [code, rows] of byEmployee.entries()) {
    const override = overrideMap.get(code);
    if (!override) continue;

    const superseded = rows.some((handset) =>
      isOverrideSupersededByCdr(
        override,
        handset.renewal_date ?? handset.RenewalDate,
        handset.collected_date ?? handset.CollectionDate ?? handset.collectedDate
      )
    );

    if (superseded) {
      await clearHandsetRenewalOverride(code);
      cleared += 1;
    }
  }

  return cleared;
}

function getEffectiveRenewalDate(employeeCode, cdrRenewalDate, overrideMap, cdrCollectedDate) {
  const override = overrideMap?.get(normalizeEmployeeCode(employeeCode));
  if (
    override?.renewalDate &&
    !isOverrideSupersededByCdr(override, cdrRenewalDate, cdrCollectedDate)
  ) {
    return override.renewalDate;
  }
  return cdrRenewalDate ?? null;
}

function applyEffectiveRenewalDate(handset, overrideMap) {
  const employeeCode =
    handset.EmployeeCode ||
    handset.employee_code ||
    handset.employeeCode ||
    null;
  const cdrDate = handset.RenewalDate ?? handset.renewal_date ?? null;
  const collectedDate =
    handset.CollectionDate ??
    handset.collected_date ??
    handset.collectedDate ??
    null;
  const override = overrideMap?.get(normalizeEmployeeCode(employeeCode));
  const usingOverride =
    Boolean(override?.renewalDate) &&
    !isOverrideSupersededByCdr(override, cdrDate, collectedDate);
  const effective = getEffectiveRenewalDate(
    employeeCode,
    cdrDate,
    overrideMap,
    collectedDate
  );

  return {
    ...handset,
    RenewalDate: effective,
    renewal_date: effective,
    HasRenewalOverride: usingOverride,
  };
}

module.exports = {
  STAFF_PORTAL_URL,
  toDateOnlyString,
  formatRenewalDateLabel,
  buildHandsetRenewalProductionMessage,
  upsertHandsetRenewalOverride,
  clearHandsetRenewalOverride,
  clearOverridesSupersededByCdrHandsets,
  getHandsetRenewalOverrideMap,
  getEffectiveRenewalDate,
  applyEffectiveRenewalDate,
};
