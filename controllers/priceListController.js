const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Define storage and upload options for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Specify the directory where uploaded files will be stored
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Upload handler
exports.uploadDeviceList = (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(500).json({ error: "File upload failed." });
    }
    res.status(200).json({ message: "File uploaded successfully." });
  });
};

exports.getDeviceList = async (req, res) => {
  const uploadsDir = path.join(__dirname, "../uploads/");

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
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

    // Ensure the file exists
    if (fs.existsSync(filePath)) {
      const fileUrl = `/uploads/${latestFile}`; // URL to serve to frontend
      res.json({ fileUrl });
    } else {
      res.status(404).json({ error: "File not found." });
    }
  });
};
