const HSTS_MAX_AGE_SECONDS = 31536000; // 1 year
const CSP_REPORT_GROUP = "csp-endpoint";
const CSP_REPORT_MAX_AGE_SECONDS = 10886400; // 126 days

/** Fix accidental values like https://https://ambaspherebackend.mtc.com.na/... */
function normalizeCspReportUrl(url) {
  if (!url) return url;
  return String(url)
    .trim()
    .replace(/^https:\/\/http:\/\//i, "http://")
    .replace(/^http:\/\/https:\/\//i, "https://");
}

function getCspReportUrl(req) {
  const fromEnv = normalizeCspReportUrl(
    process.env.CSP_REPORT_URL || process.env.REACT_APP_CSP_REPORT_URL
  );
  if (fromEnv) {
    return fromEnv;
  }

  const host = req?.get?.("host");
  if (host) {
    const proto = req.protocol || "https";
    return `${proto}://${host}/csp-report`;
  }

  return "https://ambaspherebackend.mtc.com.na/csp-report";
}

/**
 * Restrictive CSP for API responses.
 * Blocks framing/plugins and disallows unexpected content loading.
 */
function buildCspHeader() {
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
}

function buildReportToHeader(reportUrl) {
  return JSON.stringify({
    group: CSP_REPORT_GROUP,
    max_age: CSP_REPORT_MAX_AGE_SECONDS,
    endpoints: [{ url: reportUrl }],
  });
}

/**
 * Security response headers:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Restrictive CSP (+ report-to)
 * - HSTS when live in production (NOTIFICATION_EMAIL_TEST_ONLY=false)
 */
const securityHeaders = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
  const emailTestOnly = process.env.NOTIFICATION_EMAIL_TEST_ONLY !== "false";
  const reportUrl = getCspReportUrl(req);

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", buildCspHeader());
  res.setHeader(
    "Reporting-Endpoints",
    `${CSP_REPORT_GROUP}="${reportUrl}"`
  );
  res.setHeader("Report-To", buildReportToHeader(reportUrl));

  if (isProduction && !emailTestOnly) {
    res.setHeader(
      "Strict-Transport-Security",
      `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`
    );
  }

  next();
};

module.exports = securityHeaders;
module.exports.getCspReportUrl = getCspReportUrl;
module.exports.CSP_REPORT_GROUP = CSP_REPORT_GROUP;
module.exports.buildCspHeader = buildCspHeader;
module.exports.buildReportToHeader = buildReportToHeader;
