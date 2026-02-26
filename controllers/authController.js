const Staff = require("../models/Staff");
const {
  createToken,
  createRefreshToken,
} = require("../middlewares/jwtGenerationMiddleware");
const jwt = require("jsonwebtoken");
const logger = require("../middlewares/errorLogger");
const authenticate = require("../middlewares/ldapAuth");

exports.login = async (req, res) => {
  const { Username, Password } = req.body;

  console.log("Received login request:", req.body); // Log the full request body

  if (!Username || !Password) {
    return res
      .status(400)
      .json({ message: "Username and Password are required" });
  }

  try {
    // Log the username before finding the staff member
    console.log("Searching for staff with Username:", Username);

    const staff = await Staff.findOne({
      where: {
        Username,
        EmploymentStatus: "Active", // Make sure this matches your DB structure
      },
    });

    // Check if the staff is found
    if (!staff) {
      console.error(`Staff not found for Username: ${Username}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("Staff member found:", staff);

    // LDAP authentication
    authenticate(Username, Password, (err, userDN) => {
      if (err) {
        console.error("LDAP authentication failed:", err);
        return res.status(401).json({ message: "LDAP authentication failed" });
      }

      console.log("LDAP authentication successful. User DN:", userDN);
if(!userDN){
   return res.status(401).json({ message: "LDAP authentication failed"});
}
      // Proceed to generate tokens
      console.log(
        "Generating tokens for EmployeeCode:",
        staff.EmployeeCode,
        "and RoleID:",
        staff.RoleID
      );

      const token = createToken(staff.EmployeeCode, staff.RoleID);
      const refreshToken = createRefreshToken(staff.EmployeeCode, staff.RoleID);

      if (!token || !refreshToken) {
        console.error("Token generation failed");
        return res.status(500).json({ message: "Failed to generate tokens" });
      }

      console.log("Tokens generated successfully");

      // Send the response with tokens
      return res
        .header("Authorization", `Bearer ${token}`)
        .header("X-Refresh-Token", refreshToken)
        .status(200)
        .json({
          message: `User authenticated: ${userDN.dn}`,
          employee: staff,
        });
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Failed to login",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.logout = (req, res) => {
  try {
    // Clear tokens on the client-side
    return res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      message: "Failed to log out",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.refresh = (req, res) => {
  const authHeader = req.headers["Authorization"]; // Get refresh token from headers
  const refreshToken = authHeader ? authHeader.replace('Bearer ', '') : null;

  console.log('Refresh token request - Auth header:', authHeader);
  console.log('Refresh token extracted:', refreshToken ? 'Present' : 'Missing');

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_KEY);
    console.log('Decoded refresh token:', decoded); // Debug decoding

    const newToken = createToken(decoded.EmployeeCode, decoded.RoleID);
    const newRefreshToken = createRefreshToken(
      decoded.EmployeeCode,
      decoded.RoleID
    );

    // Send new tokens in response headers
    return res
      .header("Authorization", `Bearer ${newToken}`)
      .header("X-Refresh-Token", newRefreshToken)
      .status(200)
      .json({
        message: "Token refreshed successfully",
        token: newToken, // Include the new token in the response body as well
        refreshToken: newRefreshToken,
      });
  } catch (error) {
    console.error('Refresh token error:', error.message);
    logger.error(error);
    return res.status(403).json({
      message: "Failed to refresh token",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
