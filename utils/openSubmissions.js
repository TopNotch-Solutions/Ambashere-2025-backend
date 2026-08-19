const { Op } = require("sequelize");

function isReceivedFlag(value) {
  return value === true || value === 1 || value === "1";
}

function openSubmissionWhere() {
  return {
    [Op.or]: [
      { subscription_status: { [Op.in]: ["pending", "in progress"] } },
      {
        [Op.and]: [
          { subscription_status: "completed" },
          { isReceived: false },
        ],
      },
    ],
  };
}

module.exports = {
  isReceivedFlag,
  openSubmissionWhere,
};
