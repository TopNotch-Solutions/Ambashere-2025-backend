const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const addPaymentConfirmedBy = async () => {
  try {
    console.log("Starting migration: Adding PaymentConfirmedBy field to handsets table...");
    
    // Add the PaymentConfirmedBy column
    await sequelize.query(`
      ALTER TABLE handsets 
      ADD COLUMN PaymentConfirmedBy VARCHAR(255) NULL AFTER PaymentConfirmed
    `);
    
    console.log("✅ Successfully added PaymentConfirmedBy field to handsets table");
    
  } catch (error) {
    console.error("❌ Error adding PaymentConfirmedBy field:", error);
    throw error;
  }
};

module.exports = addPaymentConfirmedBy;
