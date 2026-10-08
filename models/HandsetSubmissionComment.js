const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HandsetSubmissionComment = sequelize.define(
  "handset_submission_comments",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    submissionId: {
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
    tableName: "handset_submission_comments",
    timestamps: true,
  }
);

module.exports = HandsetSubmissionComment;
