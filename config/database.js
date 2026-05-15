const Sequelize = require('sequelize');

const sequelize = new Sequelize({
  host: "172.19.13.140",
  username: "dbAdmin",
  password: "Ambasphere",
  database: "airtimemanagement",
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