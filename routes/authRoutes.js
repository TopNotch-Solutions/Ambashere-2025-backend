const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  issueCsrfToken,
  verifyCsrfProtection,
} = require("../middlewares/csrfMiddleware");

router.get("/csrf-token", issueCsrfToken);
router.post("/login", verifyCsrfProtection, authController.login);
router.post("/refresh", authController.refresh);
router.get("/logout", authController.logout);

module.exports = router;
