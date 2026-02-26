const express = require('express');
const router = express.Router();
const multer = require('multer');
const excelFileUploadController = require('../controllers/excelFileUploadController');
const { tokenAuthMiddleware, checkAdmin } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');

router.post('/upload', upload, checkAdmin, excelFileUploadController.upload);

module.exports = router;