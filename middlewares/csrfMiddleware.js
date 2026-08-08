const crypto = require("crypto");

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_BODY_FIELD = "_csrf";
const CSRF_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCsrfSecret() {
  return (
    process.env.CSRF_SECRET ||
    process.env.TOKEN_KEY ||
    "ambasphere-csrf-dev-secret"
  );
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", getCsrfSecret())
    .update(payload)
    .digest("hex");
}

function createCsrfToken() {
  const nonce = crypto.randomBytes(24).toString("hex");
  const expires = String(Date.now() + CSRF_TTL_MS);
  const payload = `${nonce}.${expires}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyCsrfToken(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [nonce, expires, signature] = parts;
  if (!nonce || !expires || !signature) {
    return false;
  }

  const payload = `${nonce}.${expires}`;
  const expected = signPayload(payload);

  if (!timingSafeEqualString(signature, expected)) {
    return false;
  }

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  return true;
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: CSRF_TTL_MS,
  };
}

function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    ...getCookieOptions(),
    maxAge: 0,
  });
}

function extractSubmittedToken(req) {
  const headerToken =
    req.get("X-CSRF-Token") ||
    req.get("X-XSRF-Token") ||
    req.headers[CSRF_HEADER_NAME];
  const bodyToken = req.body?.[CSRF_BODY_FIELD] || req.body?.csrfToken;
  return headerToken || bodyToken || null;
}

/**
 * Issues a CSRF token for the login form (synchronizer + cookie).
 */
function issueCsrfToken(req, res) {
  const csrfToken = createCsrfToken();
  setCsrfCookie(res, csrfToken);
  return res.status(200).json({ csrfToken });
}

/**
 * Validates CSRF token on state-changing auth requests (e.g. login).
 */
function verifyCsrfProtection(req, res, next) {
  const submittedToken = extractSubmittedToken(req);
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!verifyCsrfToken(submittedToken)) {
    return res.status(403).json({
      message: "Invalid or missing CSRF token",
    });
  }

  // Double-submit: when cookie is present it must match the submitted token
  if (cookieToken && !timingSafeEqualString(cookieToken, submittedToken)) {
    return res.status(403).json({
      message: "CSRF token mismatch",
    });
  }

  return next();
}

module.exports = {
  CSRF_COOKIE_NAME,
  CSRF_BODY_FIELD,
  issueCsrfToken,
  verifyCsrfProtection,
  createCsrfToken,
  verifyCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
};
