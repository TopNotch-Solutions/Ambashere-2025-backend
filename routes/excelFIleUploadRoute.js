const express = require('express');
const router = express.Router();
const excelFileUploadController = require('../controllers/excelFileUploadController');
const { tokenAuthMiddleware, checkAdmin } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.post('/upload', checkAdmin, ...excelFileUploadController.upload);

module.exports = router;
