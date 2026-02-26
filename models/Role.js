const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Role = sequelize.define(
    "roles",
    {
        RoleID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        RoleName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    {
        timestamps: false,
    }
);

Role.associate = (models) => {
    Role.hasMany(models.Employees, {
        foreignKey: "RoleID",
        sourceKey: "RoleID",
    });
};

module.exports = Role;