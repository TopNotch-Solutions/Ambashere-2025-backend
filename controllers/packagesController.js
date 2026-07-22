const Packages = require("../models/Packages");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");

const toBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return value === true || value === 1 || value === "1" || value === "true";
};

exports.createPackage = async (req, res) => {
  try {
    const {
      PackageName,
      PaymentPeriod,
      MonthlyPrice,
      IsActive = true,
      AllowsDevice = true,
    } = req.body;

    const newPackage = await Packages.create({
      PackageName,
      PaymentPeriod,
      MonthlyPrice,
      IsActive: toBoolean(IsActive, true),
      AllowsDevice: toBoolean(AllowsDevice, true),
    });

    res.status(200).json(newPackage);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to create package:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getPackages = async (req, res) => {
  try {
    const packages = await Packages.findAll();
    res.status(200).json(packages);
  } catch (error) {
    console.log("Here is the error:", error);
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve package details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.updatePackage = async (req, res) => {
  const { id } = req.params;
  let { PackageName, PaymentPeriod, MonthlyPrice, IsActive, AllowsDevice } =
    req.body;

  if (
    PackageName === undefined ||
    PackageName === null ||
    String(PackageName).trim() === "" ||
    PaymentPeriod === undefined ||
    PaymentPeriod === null ||
    PaymentPeriod === "" ||
    MonthlyPrice === undefined ||
    MonthlyPrice === null ||
    MonthlyPrice === ""
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    if (typeof PaymentPeriod === "string") {
      PaymentPeriod = PaymentPeriod.replace(/\s*months?/i, "").trim();
    }

    if (typeof MonthlyPrice === "string") {
      MonthlyPrice = MonthlyPrice.replace(/[^\d.-]/g, "");
    }

    const existingPackage = await Packages.findOne({
      where: { PackageID: id },
    });

    if (!existingPackage) {
      return res
        .status(404)
        .json({ message: `Package with ID ${id} not found.` });
    }

    const parsedPeriod = parseInt(PaymentPeriod, 10);
    const parsedPrice = parseFloat(MonthlyPrice);

    if (Number.isNaN(parsedPeriod) || Number.isNaN(parsedPrice)) {
      return res.status(400).json({
        message: "PaymentPeriod and MonthlyPrice must be valid numbers.",
      });
    }

    const nextIsActive =
      IsActive !== undefined
        ? toBoolean(IsActive, existingPackage.IsActive)
        : existingPackage.IsActive;

    const nextAllowsDevice =
      AllowsDevice !== undefined
        ? toBoolean(AllowsDevice, existingPackage.AllowsDevice ?? true)
        : existingPackage.AllowsDevice ?? true;

    await Packages.update(
      {
        PackageName: String(PackageName).trim(),
        PaymentPeriod: String(parsedPeriod),
        MonthlyPrice: parsedPrice,
        IsActive: nextIsActive,
        AllowsDevice: nextAllowsDevice,
      },
      {
        where: { PackageID: id },
      }
    );

    return res.status(200).json({ message: `Package ${id} has been updated.` });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      message: "Failed to update package.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.removePackage = async (req, res) => {
  try {
    const { PackageID } = req.params;

    if (!PackageID) {
      return res.status(400).json({
        message: "PackageID is required.",
      });
    }

    const deletedPackage = await Packages.destroy({
      where: {
        PackageID: PackageID,
      },
    });

    if (deletedPackage) {
      res.status(200).json({
        message: `Package with ID ${PackageID} has been deleted.`,
      });
    } else {
      res.status(404).json({
        message: `Package with ID ${PackageID} not found.`,
      });
    }
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to delete package.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getPackageList = async (req, res) => {
  try {
    let staffPackages;
    try {
      staffPackages = await sequelize.query(
        `SELECT PackageID, PackageName, MonthlyPrice, AllowsDevice FROM packages WHERE IsActive = true`,
        { type: sequelize.QueryTypes.SELECT }
      );
    } catch (columnError) {
      console.log(
        "AllowsDevice/IsActive column issue, falling back for package list"
      );
      try {
        staffPackages = await sequelize.query(
          `SELECT PackageID, PackageName, MonthlyPrice FROM packages WHERE IsActive = true`,
          { type: sequelize.QueryTypes.SELECT }
        );
        staffPackages = staffPackages.map((pkg) => ({
          ...pkg,
          AllowsDevice: true,
        }));
      } catch (fallbackError) {
        staffPackages = await sequelize.query(
          `SELECT PackageID, PackageName, MonthlyPrice FROM packages`,
          { type: sequelize.QueryTypes.SELECT }
        );
        staffPackages = staffPackages.map((pkg) => ({
          ...pkg,
          AllowsDevice: true,
        }));
      }
    }

    res.status(200).json(staffPackages);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve package list:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getActivePackages = async (req, res) => {
  try {
    let activePackages;
    try {
      activePackages = await Packages.findAll({
        where: { IsActive: true },
        order: [["PackageName", "ASC"]],
      });
    } catch (columnError) {
      console.log("IsActive column not found, returning all packages");
      activePackages = await Packages.findAll({
        order: [["PackageName", "ASC"]],
      });
    }

    res.status(200).json(activePackages);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve active packages:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const packageRecord = await Packages.findByPk(req.params.id);
    if (!packageRecord) {
      return res.status(404).json({ message: "Package not found" });
    }
    res.json(packageRecord);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve package by employee code:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
