const jwt = require("jsonwebtoken");
require('dotenv').config();

exports.createToken = (EmployeeCode, RoleID) => {
  return jwt.sign(
    { EmployeeCode, RoleID },
    process.env.TOKEN_KEY,
    {
      expiresIn: '4h',
    }
  );
};

exports.createRefreshToken = (EmployeeCode, RoleID) => {
  return jwt.sign(
    { EmployeeCode, RoleID },
    process.env.REFRESH_KEY,
    {
      expiresIn: '4h',
    }
  );
};
