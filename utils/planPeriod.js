/**
 * CDR Live may send plan_period as 36.000000 or {} (empty).
 * Persist/display as a whole number, or null when missing.
 */
function normalizePlanPeriod(value) {
  if (value == null) return null;
  if (typeof value === "object") return null;
  if (value === "" || value === "null" || value === "undefined") return null;

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.trunc(parsed);
}

function formatPlanPeriod(value) {
  const period = normalizePlanPeriod(value);
  return period == null ? "-" : String(period);
}

module.exports = {
  normalizePlanPeriod,
  formatPlanPeriod,
};
