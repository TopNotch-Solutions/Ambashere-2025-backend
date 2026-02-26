const Image = require("../models/Image");
const Staff = require("../models/Staff");
const upload = require("multer")(); 
const logger = require("../middlewares/errorLogger")

// Upload Image Path to Database
exports.updateProfilePicture = upload.single("profilePhoto", async (req, res) => {
  try {
    const userId = req.body.userId; // Assuming the user ID is sent as part of the request body
    const file = req.file;
    if (!userId || !file) {
      return res.status(400).json({ message: "Missing user ID or file" });
    }

    // Check file size
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB (adjust as needed)
    if (file.size > maxSizeInBytes) {
      return res
        .status(400)
        .json({ message: "File size exceeds the maximum allowed size" });
    }

    // Check file type
    const allowedFileTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]; // Adjust as needed
    if (!allowedFileTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: "File type is not allowed" });
    }

    const imagePath = file.path;
    
    // Fetch the existing profile picture record from the database (if any)
    let existingImage;
    try {
      existingImage = await Image.findOne({ where: { EmployeeCode: userId } });
    } catch (error) {
      console.error("Error fetching existing profile picture:", error);
      return res.status(500).json({ message: "Server error" });
    }

    // If an existing profile picture exists, update it; otherwise, create a new one
    if (existingImage) {
      // Update existing profile picture record
      existingImage.Path = file.path;
      existingImage.Size = file.size;
      existingImage.Type = file.mimetype;
      existingImage.ModifiedAt = new Date();
      try {
        await existingImage.save();
      } catch (error) {
        console.error("Error updating profile picture:", error);
        return res.status(500).json({ message: "Server error" });
      }
    } else {
      // Create a new profile picture record
      const newImage = new Image({
        EmployeeCode: userId,
        photoID: generatePhotoID(),
        Name: file.originalname,
        Title: "Profile Picture", // You can customize this if needed
        Description: "Profile Picture", // You can customize this if needed
        Extension: file.originalname.split(".").pop(), // Get file extension
        Path: imagePath,
        Size: file.size ,
        Type: file.mimetype,
        CreatedAt: new Date(),
        ModifiedAt: new Date(),
      });
      try {
        await newImage.save();
      } catch (error) {
        console.error("Error saving profile picture:", error);
        return res.status(500).json({ message: "Server error" });
      }
    }

    // console.log("Request parameters:", req.body, req.file);
    res.status(200).json({ message: "Profile picture updated successfully" });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).json({ message: "Server error" });
  }
});

exports.getProfilePicture = async (req, res) => {
  try {
    const userId = req.params.userId; // Assuming the user ID is passed as a route parameter
    if (!userId) {
      return res.status(400).json({ message: "Missing user ID" });
    }

    // Fetch the profile picture record from the database
    let profilePicture;
    try {
      profilePicture = await Image.findOne({ where: { EmployeeCode: userId } });
    } catch (error) {
      console.error("Error fetching profile picture:", error);
      return res.status(500).json({ message: "Server error" });
    }

    if (!profilePicture) {
      return res.status(404).json({ message: "Profile picture not found" });
    }
  
    res.status(200).json(profilePicture);
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.postProfilePicture = async (req, res) => {
 try{
  const userId = req.params.userId;
  const ProfileImage = req.body;
//   console.log(ProfileImage);
//   console.log('Type of profileImage:', typeof ProfileImage); // Should be 'string'
// console.log('Received profileImage:', ProfileImage);
    if (!userId) {
      return res.status(400).json({ message: "Missing fields" });
    }else{
      const staff = await Staff.findOne({ where: { EmployeeCode: userId } });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }else{
      const newStaff = await Staff.update({ProfileImage}, { where: { EmployeeCode: userId } });
      if (!newStaff) {
        return res.status(404).json({ message: "Staff not found" });
      }else{
        const staffUpdated = await Staff.findOne({ where: { EmployeeCode: userId } });
        
        res.status(200).json({ message: "Staff record updated successfully" , ProfileImage: staffUpdated.ProfileImage});
      }
   
    }
   
    }
 }catch(error){
  console.error("Error fetching profile picture:", error);
    res.status(500).json({ message: "Server error " + error.message });
 }
}