const Sequelize = require('sequelize');
require("dotenv").config();

const sequelize = new Sequelize({
  host: process.env.HOST,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB,
  dialect: "mysql",
  // Sequelize-only option (do not pass via dialectOptions — MySQL2 rejects it)
  attributeBehavior: "unsafe-legacy",
});
// const sequelize = new Sequelize({
//     host: "localhost",
//     username: "root",
//     password: "",
//     database: "airtimemanagement",
//     dialect: "mysql"
// })



module.exports = sequelize;