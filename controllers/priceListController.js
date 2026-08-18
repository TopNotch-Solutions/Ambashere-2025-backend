const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CdrLiveDeviceCost = require("../models/crdliveDeviceCost");
const { logError } = require("../middlewares/errorLogger");
const { wrapMulter } = require("../middlewares/fileUploadErrorHandler");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

exports.uploadDeviceList = (req, res) => {
  wrapMulter(upload.single("file"))(req, res, () => {
    res.status(200).json({ message: "File uploaded successfully." });
  });
};

exports.getDeviceList = async (req, res) => {
  const uploadsDir = path.join(__dirname, "../uploads/");

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      logError("Failed to read uploads directory", {
        stack: err.stack,
        message: err.message,
        method: req.method,
        url: req.originalUrl,
      });
      return res.status(500).json({ error: "Failed to retrieve files." });
    }

    files.sort((a, b) => {
      return (
        fs.statSync(path.join(uploadsDir, b)).mtime.getTime() -
        fs.statSync(path.join(uploadsDir, a)).mtime.getTime()
      );
    });

    if (files.length === 0) {
      return res.status(404).json({ error: "No files found." });
    }

    const latestFile = files[0];
    const filePath = path.join(uploadsDir, latestFile);

    if (fs.existsSync(filePath)) {
      const fileUrl = `/uploads/${latestFile}`;
      res.json({ fileUrl });
    } else {
      res.status(404).json({ error: "File not found." });
    }
  });
};

exports.newDeviceList = async (req, res) => {
  try {
    const newDeviceList = await CdrLiveDeviceCost.findAll();
    return res.status(200).json({
      status: "SUCCESS",
      message: "New device cost list",
      data: newDeviceList,
    });
  } catch (error) {
    logError("Error fetching device price list", error);
    return res.status(500).json({ message: "Failed to fetch device price list." });
  }
};
