const jwt = require("jsonwebtoken");
require("dotenv").config();
const { createToken } = require("./jwtGenerationMiddleware");

module.exports.tokenAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No Authorization header or invalid format.",
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.WEB_TOKEN); // Use the correct key
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      console.log("Token expired, refreshing required.");
      return res.status(401).json({
        status: "FAILURE",
        message: "Token expired. Please refresh.",
      });
    } else {
      console.log("Token error:", err.message);
      return res.status(400).json({
        status: "FAILURE",
        message: "Invalid token.",
      });
    }
  }
};


// Middleware to check if the user is an admin
module.exports.checkAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    // Check if the user's role is not admin (RoleID = 1)
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User does not have access to this route.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

// Middleware to check if the user is an admin or a standard user (RoleID = 1 or 3)
module.exports.checkAdminUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    // Check if the user's role is neither admin nor standard user
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};
  
module.exports.checkAllUsers = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

module.exports.checkTempUsers = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

module.exports.checkEditor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID != 2) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

module.exports.checkUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

module.exports.checkFixedAssetTeam = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

module.exports.checkBillingTeam = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID !== 5) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

module.exports.checkKeyAccountsSupervisor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID != 6) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

module.exports.checkERTeam = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID != 7) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not an admin or user.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

// Middleware to check if the user is Finance team (RoleID 9)
module.exports.checkFinance = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not authorized for finance operations.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};
// Middleware to check if the user is Retail team (RoleID 10)
module.exports.checkRetail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not authorized for retail operations.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};

// Middleware to check if the user is Warehouse team (RoleID 11)
module.exports.checkWarehouse = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Access denied. No token provided.",
    });
  }

  try {
    if (req.user.RoleID !== 1 && req.user.RoleID !== 3 && req.user.RoleID !== 9 && req.user.RoleID !== 10 && req.user.RoleID !== 11) {
      return res.status(403).json({
        status: "FAILURE",
        message: "Access denied. User is not authorized for warehouse operations.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: "FAILURE",
      message: "Invalid token.",
    });
  }
};
