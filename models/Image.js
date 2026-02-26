const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Image = sequelize.define(
  "images",
  {
    photoID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    EmployeeCode: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "employees",
        key: "EmployeeCode",
      },
    },
    Name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Extension: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Path: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Size: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    Type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    URL: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Medium: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Small: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Thumb: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Caption: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    altText: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ModifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: false,
  }
);

Image.associate = (models) => {
  Image.belongsTo(models.Staff, {
    foreignKey: "EmployeeCode",
    targetKey: "EmployeeCode",
  });
};

module.exports = Image;
