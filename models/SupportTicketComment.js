const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SupportTicketComment = sequelize.define(
  "support_ticket_comments",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    adminCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: "support_ticket_comments",
    timestamps: true,
  }
);

module.exports = SupportTicketComment;
