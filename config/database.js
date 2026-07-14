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
  pool: {
    max: 20,         // Maximum number of connection in pool (Default is 5)
    min: 0,          // Minimum number of connection in pool
    acquire: 60000,  // The maximum time, in milliseconds, that pool will try to get connection before throwing error (60s)
    idle: 10000      // The maximum time, in milliseconds, that a connection can be idle before being released (10s)
  }
});
// const sequelize = new Sequelize({
//     host: "localhost",
//     username: "root",
//     password: "",
//     database: "airtimemanagement",
//     dialect: "mysql"
// })



module.exports = sequelize;