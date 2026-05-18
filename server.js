const express = require("express");
const bodyParser = require("body-parser");
const sequelize = require("./config/database");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http"); // Import http module
const multer = require("multer"); // Import multer
const socketIo = require("socket.io");
const cron = require("node-cron");
const morgan = require("morgan");
const logger = require("./middlewares/errorLogger");
const errorHandler = require("./middlewares/errorHandlerMiddleware");
const path = require("path");

require("dotenv").config();
const { tokenAuthMiddleware } = require("./middlewares/authMiddleware");

// Routes
const authRoutes = require("./routes/authRoutes");
const imageRoutes = require("./routes/imageRoutes");
const staffRoutes = require("./routes/staffRoutes");
const handsetRoutes = require("./routes/handsetsRoutes");
const packagesRoutes = require("./routes/packagesRoutes");
const contractsRoutes = require("./routes/contractsRoutes");
const excelFileUploadRoute = require("./routes/excelFIleUploadRoute");
const notificationsRoutes = require("./routes/notificationsRoutes");
const priceListRoutes = require("./routes/priceListRoutes");
const eventsRoutes = require("./routes/eventsRoutes");
const emailRoutes = require("./routes/emailRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const financeRoutes = require("./routes/financeRoutes");
const CdrLiveDeviceCost = require("./models/crdliveDeviceCost");
const {
  processHandsetWeekRenewals,
  processHandsetRenewalsDueToday,
  processContractWeekRenewals,
  processContractsExpiringToday,
} = require("./jobs/renewalNotificationJobs");
const { processNotificationEmails } = require("./jobs/notificationEmailJobs");
const CdrLiveEmployeeContractDetails = require("./models/crdliveEmployeeContractDetail");
const CdrLiveEmployeeDetail = require("./models/crdliveEmployeeDetail");
const CdrLiveEmployeeHandsetDetail = require("./models/crdliveEmployeeHandsetDetail");

const app = express();
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://mtcprdstaffapp01.mtcdc.com.na"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    exposedHeaders: ['Authorization', 'X-Refresh-Token'],
  },
});

app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);
app.use(bodyParser.json({ limit: "50mb" }));

app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.use(cookieParser());

app.use(
  cors({
    origin: ["http://localhost:3000","http://mtcprdstaffapp01.mtcdc.com.na"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    exposedHeaders: ['Authorization', 'X-Refresh-Token'],
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Defining the routes

//authentication API Calls
app.use("/auth", authRoutes);

// Staff API Calls
app.use("/staffmember", staffRoutes);

// Device API Calls
app.use("/handsets", handsetRoutes);


// Package API Calls
app.use("/packages", packagesRoutes);

// Contract API Calls
app.use("/contracts", contractsRoutes);

// Profile Picture API Calls
app.use("/image", imageRoutes);

// Excel API Calls
app.use("/excel", excelFileUploadRoute);

// Notification API Calls
app.use("/notifications", notificationsRoutes);

// Price List API Calls
app.use("/pricelist", priceListRoutes);

// Events API Calls
app.use("/events", eventsRoutes);

// Email API Calls
app.use("/email", emailRoutes);

// Reports API Calls
app.use("/reports", reportsRoutes);

// Finance API Calls
app.use("/finance", financeRoutes);

app.use("/*", (req, res) => {
  res.status(404).json({ message: "Page not found" });
});

cron.schedule("0 1 14 * *", async () => {
  try {
    const airtimeController = require("./controllers/airtimeController"); // Import your controller

    await airtimeController.allocateMonthly(); // Call the controller function

    console.log("Airtime allocated successfully.");
  } catch (error) {
    console.error("Error allocating airtime:", error);
  }
});

const HOURLY_CRON = "0 * * * *";

cron.schedule(HOURLY_CRON, async () => {
  try {
    await processHandsetWeekRenewals();
  } catch (error) {
    logger.error("Handset 7-day renewal cron failed:", error);
  }
});

cron.schedule(HOURLY_CRON, async () => {
  try {
    await processHandsetRenewalsDueToday();
  } catch (error) {
    logger.error("Handset same-day renewal cron failed:", error);
  }
});

cron.schedule(HOURLY_CRON, async () => {
  try {
    await processContractWeekRenewals();
  } catch (error) {
    logger.error("Contract 7-day renewal cron failed:", error);
  }
});

cron.schedule(HOURLY_CRON, async () => {
  try {
    await processContractsExpiringToday();
  } catch (error) {
    logger.error("Contract same-day expiry cron failed:", error);
  }
});

// Notification emails → PWilhelm@mtc.com.na (see notificationEmailJobs.js)
// Default: every minutes. For rapid testing: NOTIFICATION_EMAIL_CRON="* * * * * *" (every second)
// const NOTIFICATION_EMAIL_CRON =
//   process.env.NOTIFICATION_EMAIL_CRON || "*/1 * * * *";

// cron.schedule(NOTIFICATION_EMAIL_CRON, async () => {
//   try {
//     await processNotificationEmails();
//   } catch (error) {
//     logger.error("Notification email cron failed:", error);
//   }
// });

cron.schedule('*/1 * * * *', async () => {
  const transaction = await sequelize.transaction();

  try {
    const response = await fetch(process.env.DEVICE_COST_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.AUTHORIZATION,
        'X-Username': process.env.X_USERNAME,
        'X-Password': process.env.X_PASSWORD
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const deviceCosts = await response.json();

    if (!Array.isArray(deviceCosts) || deviceCosts.length === 0) {
      throw new Error("Invalid or empty device cost response");
    }

    await CdrLiveDeviceCost.destroy({
      where: {},
      truncate: true,
      transaction
    });

    const formattedData = deviceCosts.map(device => ({
      device_name: device.device_name,
      amount: parseFloat(device.amount),
      device_group: device.device_group,
      staff_discounted_amount: parseFloat(device.staff_discounted_amount)
    }));

    await CdrLiveDeviceCost.bulkCreate(formattedData, { transaction });

    await transaction.commit();

    console.log("Device costs replaced successfully");

  } catch (error) {
    await transaction.rollback();

    console.error("Transaction rolled back:", error.message);
  }
});

cron.schedule("*/1 * * * *", async () => {
  const transaction = await sequelize.transaction();

  try {
    const response = await fetch(process.env.EMPLOYEE_CONTRACT_DETAILS, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.AUTHORIZATION,
        "X-Username": process.env.X_USERNAME,
        "X-Password": process.env.X_PASSWORD,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const contractData = await response.json();

    if (!Array.isArray(contractData) || contractData.length === 0) {
      throw new Error("Invalid or empty contract data");
    }

    await CdrLiveEmployeeContractDetails.destroy({
      where: {},
      truncate: true,
      transaction,
    });

    const toNumberOrZero = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const formattedData = contractData.map((c) => ({
      package: c.package,
      msisdn: c.msisdn,
      device: c.device,
      contract_duration: toNumberOrZero(c.contract_duration),
      contract_start_date: new Date(c.contract_start_date),
      contract_end_date: new Date(c.contract_end_date),
      package_price: toNumberOrZero(c.package_price),
      device_initial_cost: toNumberOrZero(c.device_initial_cost),
      device_upfront_payment: toNumberOrZero(c.device_upfront_payment),
      device_payout_balance: toNumberOrZero(c.device_payout_balance),
      device_monthly_price: toNumberOrZero(c.device_monthly_price),
      serviceplan_monthly_price: toNumberOrZero(c.serviceplan_monthly_price),
      subscription_status: c.subscription_status,
      staff_msisdn: c.staff_msisdn,
      employee_code: String(c.employee_code || "").replace(/-/g, ""),
    }));

    await CdrLiveEmployeeContractDetails.bulkCreate(formattedData, { transaction });

    await transaction.commit();

    console.log("Employee contract details updated successfully");

  } catch (error) {
    await transaction.rollback();
    console.error("Transaction rolled back:", error.message);
  }
});

cron.schedule("*/1 * * * *", async () => {
  const transaction = await sequelize.transaction();

  try {
    const toNumberOrZero = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const response = await fetch(process.env.EMPLOYEE_DETAILS, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.AUTHORIZATION,
        "X-Username": process.env.X_USERNAME,
        "X-Password": process.env.X_PASSWORD,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const employeeData = await response.json();

    if (!Array.isArray(employeeData) || employeeData.length === 0) {
      throw new Error("Invalid or empty employee data");
    }

    await CdrLiveEmployeeDetail.destroy({
      where: {},
      truncate: true,
      transaction,
    });

    const formattedData = employeeData.map((emp) => ({
      msisdn: emp.msisdn,
      employee_code: String(emp.employee_code || "").replace(/-/g, ""),
      full_names: emp.full_names,
      last_name: emp.last_name,
      username: emp.username || null,
      email: emp.email || null,
      gender: emp.gender || null,
      position: emp.position || null,
      division: emp.division || null,
      employee_category: emp.employee_category || null,
      employment_status: emp.employment_status || null,
      employment_start_date: emp.employment_start_date
        ? new Date(emp.employment_start_date)
        : null,
      employment_end_date: emp.employment_end_date
        ? new Date(emp.employment_end_date)
        : null,
      serviceplan: emp.serviceplan || null,
      airtime_allocation: toNumberOrZero(emp.airtime_allocation),
    }));

    await CdrLiveEmployeeDetail.bulkCreate(formattedData, { transaction });

    await transaction.commit();

    console.log("Employee details updated successfully");

  } catch (error) {
    await transaction.rollback();
    console.error("Transaction rolled back:", error.message);
  }
});

cron.schedule("*/1 * * * *", async () => {
  const transaction = await sequelize.transaction();

  try {
    const toNumberOrZero = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const response = await fetch(process.env.EMPLOYEE_HANDSET_DETAILS, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.AUTHORIZATION,
        "X-Username": process.env.X_USERNAME,
        "X-Password": process.env.X_PASSWORD,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const handsetData = await response.json();
    console.log("console log",handsetData)
    if (!Array.isArray(handsetData) || handsetData.length === 0) {
      throw new Error("Invalid or empty handset data");
    }

 
    await CdrLiveEmployeeHandsetDetail.destroy({
      where: {},
      truncate: true,
      transaction,
    });

    const formattedData = handsetData.map((h) => ({
      mr_number: h.mr_number,
      employee_code: String(h.employee_code || "").replace(/-/g, ""),
      employee_name: h.employee_name,
      part_no: h.part_no,
      description: h.description || null,
      fixed_asset_code: h.fixed_asset_code || null,
      cost: toNumberOrZero(h.cost),
      renewal_date: h.renewal_date ? new Date(h.renewal_date) : null,
      collected_date: h.collected_date ? new Date(h.collected_date) : null,
      status: h.status || null
    }));

    await CdrLiveEmployeeHandsetDetail.bulkCreate(formattedData, { transaction });

    await transaction.commit();

    console.log("Employee handset details updated successfully");

  } catch (error) {
    await transaction.rollback();
    console.error("Transaction rolled back:", error.message);
  }
});


app.use(errorHandler);

sequelize.options.logging = console.log;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

sequelize
  .sync()
  .then(() => {
    console.log("Database connected");
    server.listen(process.env.PORT || 4000, () => {
      console.log(`Server is running on port ${process.env.PORT || 4000}`);
    });
  })
  .catch((error) => {
    logger.error("Error synchronizing database:", error);
  });

// Socket.IO event handling
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });

  socket.on("error", (error) => {
    logger.error("Socket error:", error);
  });
});

module.exports.io = io;
