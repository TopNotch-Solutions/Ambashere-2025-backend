/**
 * Test mode: all notification emails go to PWilhelm only — never to staff inboxes.
 * Set NOTIFICATION_EMAIL_TEST_ONLY=false when ready to email employees directly.
 */
const NOTIFICATION_EMAIL_TEST_ONLY =
  process.env.NOTIFICATION_EMAIL_TEST_ONLY !== "false";

const NOTIFICATION_EMAIL_RECIPIENT = "PWilhelm@mtc.com.na";

/** Valid employees.EmployeeCode used as FK owner while testing (Paulus Wilhelm). */
const TEST_NOTIFICATION_OWNER_CODE = "EWILH05";

module.exports = {
  NOTIFICATION_EMAIL_TEST_ONLY,
  NOTIFICATION_EMAIL_RECIPIENT,
  TEST_NOTIFICATION_OWNER_CODE,
};
