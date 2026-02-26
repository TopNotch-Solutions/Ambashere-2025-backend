const express = require("express");
const router = express.Router();
const multer = require("multer");
const imageController = require("../controllers/imageController");
const {tokenAuthMiddleware,checkTempUsers } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split("/")[1];
    cb(null, `${file.originalname}-${Date.now()}.${ext}`);
  },
});

const upload = multer({ storage: storage });

router.post(
  "/updateProfilePicture/:userId",
  upload.single("profilePhoto"),
  checkTempUsers,
  imageController.updateProfilePicture
);

router.get("/:userId/profilePicture", checkTempUsers, imageController.getProfilePicture);
router.post("/:userId/profilePicture" , checkTempUsers, imageController.postProfilePicture)

module.exports = router;