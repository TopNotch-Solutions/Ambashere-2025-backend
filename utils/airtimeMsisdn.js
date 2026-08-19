function normalizeAirtimeMsisdn(value) {
  return String(value || "").replace(/\D/g, "");
}

function isRenewalTransaction(value) {
  return String(value || "").trim().toLowerCase() === "renewal";
}

function isValidAirtimeMsisdn(value) {
  return /^81\d{7}$/.test(normalizeAirtimeMsisdn(value));
}

function resolveSubmissionMsisdn(transactionType, msisdnValue) {
  const msisdn = normalizeAirtimeMsisdn(msisdnValue);

  if (isRenewalTransaction(transactionType)) {
    if (!isValidAirtimeMsisdn(msisdn)) {
      return {
        error:
          "Renewal requires a valid MSISDN starting with 81, e.g. 812081591.",
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
  isValidAirtimeMsisdn,
  resolveSubmissionMsisdn,
};
