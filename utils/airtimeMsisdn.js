function normalizeAirtimeMsisdn(value) {
  return String(value || "").replace(/\D/g, "");
}

function isRenewalTransaction(value) {
  return String(value || "").trim().toLowerCase() === "renewal";
}

function isUpgradeTransaction(value) {
  return String(value || "").trim().toLowerCase() === "upgrade";
}

/** Upgrade uses the same MSISDN / package-credit rules as Renewal. */
function isRenewalLikeTransaction(value) {
  return isRenewalTransaction(value) || isUpgradeTransaction(value);
}

function isValidAirtimeMsisdn(value) {
  return /^81\d{7}$/.test(normalizeAirtimeMsisdn(value));
}

function normalizePackageName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function packagesMatch(left, right) {
  const a = normalizePackageName(left);
  const b = normalizePackageName(right);
  return Boolean(a && b && a === b);
}

function resolveSpectraAccountNumber(accountValue) {
  const account = String(accountValue || "").trim();
  if (!account) {
    return { error: "Spectra Account Number is required." };
  }
  return { msisdn: account };
}

function resolveSubmissionMsisdn(
  transactionType,
  msisdnValue,
  { isSpectra = false } = {}
) {
  if (isSpectra) {
    return resolveSpectraAccountNumber(msisdnValue);
  }

  const msisdn = normalizeAirtimeMsisdn(msisdnValue);

  if (isRenewalLikeTransaction(transactionType)) {
    if (!isValidAirtimeMsisdn(msisdn)) {
      return {
        error:
          "Renewal/Upgrade requires a valid MSISDN starting with 81, e.g. 812081591.",
      };
    }
    return { msisdn };
  }

  if (msisdn && !isValidAirtimeMsisdn(msisdn)) {
    return {
      error: "MSISDN must start with 81 and be 9 digits, e.g. 812081591.",
    };
  }

  return { msisdn: msisdn || null };
}

module.exports = {
  normalizeAirtimeMsisdn,
  isRenewalTransaction,
  isUpgradeTransaction,
  isRenewalLikeTransaction,
  isValidAirtimeMsisdn,
  normalizePackageName,
  packagesMatch,
  resolveSpectraAccountNumber,
  resolveSubmissionMsisdn,
};
