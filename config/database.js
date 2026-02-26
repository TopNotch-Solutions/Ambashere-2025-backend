const Sequelize = require('sequelize');

const sequelize = new Sequelize({
    host: "172.19.13.140",
    username: "dbAdmin",
    password: "Ambasphere",
    database: "airtimemanagement",
    dialect: "mysql",
    attributeBehavior: "unsafe-legacy",
     dialectOptions: {
    // This restores v5 behavior
    attributeBehavior: "unsafe-legacy"
  }
})
// const sequelize = new Sequelize({
//     host: "localhost",
//     username: "root",
//     password: "",
//     database: "airtimemanagement",
//     dialect: "mysql"
// })



module.exports = sequelize;