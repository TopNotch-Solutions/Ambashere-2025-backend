const express = require("express");
const { patchExpressAsyncHandlers } = require("./middlewares/asyncHandler");
patchExpressAsyncHandlers(express);

const bodyParser = require("body-parser");
require("dotenv").config();
const logger = require("./middlewares/errorLogger");
const { logError } = logger;
const sequelize = require("./config/database");

process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logError("Unhandled promise rejection", error);
});

const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http"); // Import http module
const multer = require("multer"); // Import multer
const socketIo = require("socket.io");
const cron = require("node-cron");
const morgan = require("morgan");
const errorHandler = require("./middlewares/errorHandlerMiddleware");
const { handleFileUploadError } = require("./middlewares/fileUploadErrorHandler");
const securityHeaders = require("./middlewares/securityHeaders");
const path = require("path");
const fetch = require("node-fetch");

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
const supportTicketRoutes = require("./routes/supportTicketRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const financeRoutes = require("./routes/financeRoutes");
const CdrLiveDeviceCost = require("./models/crdliveDeviceCost");
const {
  processHandsetWeekRenewals,
  processHandsetRenewalsDueToday,
  processContractWeekRenewals,
  processContractsExpiringToday,
} = require("./jobs/renewalNotificationJobs");
const { processNotificationEmails, processCalendarNotificationEmails } = require("./jobs/notificationEmailJobs");
const { processDueEventNotifications } = require("./jobs/eventNotificationJobs");
const CdrLiveEmployeeContractDetails = require("./models/crdliveEmployeeContractDetail");
const CdrLiveEmployeeDetail = require("./models/crdliveEmployeeDetail");
const CdrLiveEmployeeHandsetDetail = require("./models/crdliveEmployeeHandsetDetail");
const AirtimeContractSubmission = require("./models/AirtimeContractSubmission");
const HandsetContractSubmission = require("./models/HandsetContractSubmission");

/** Keep last row for each key (API payload dedupe). */
const dedupeByKey = (rows, getKey) => {
  const map = new Map();
  for (const row of rows) {
    map.set(getKey(row), row);
  }
  return Array.from(map.values());
};

const dateKey = (value) => {
  if (!value) return "";
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? "" : String(time);
};

const syncJobLocks = Object.create(null);
const withSyncLock = (name, job) => async () => {
  if (syncJobLocks[name]) {
    console.warn(`Skipping ${name}: previous run still in progress`);
    return;
  }
  syncJobLocks[name] = true;
  try {
    await job();
  } finally {
    syncJobLocks[name] = false;
  }
};

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "https://ambasphereuat.mtc.com.na", "https://ambasphere.mtc.com.na"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-Token'],
    credentials: true,
    exposedHeaders: ['Authorization', 'X-Refresh-Token'],
  },
});
const { setSocketIo } = require("./config/socket");
setSocketIo(io);

app.use(securityHeaders);

app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);
app.use(bodyParser.json({
  limit: "50mb",
  type: ["application/json", "application/csp-report", "application/reports+json"],
}));

app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.use(cookieParser());
app.use(express.static("public"));

app.use(
  cors({
    origin: ["http://localhost:3000","https://ambasphereuat.mtc.com.na","https://ambasphere.mtc.com.na"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-Token'],
    credentials: true,
    exposedHeaders: ['Authorization', 'X-Refresh-Token'],
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CSP violation reports (Report-To / report-to)
app.post("/csp-report", (req, res) => {
  logger.warn("CSP violation report", { report: req.body });
  res.status(204).end();
});


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

// Support ticket API Calls
app.use("/support-tickets", supportTicketRoutes);

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
    logError("Error allocating airtime:", error);
  }
});

// Renewal notifications: once daily at 09:00
const RENEWAL_NOTIFICATION_CRON =
  process.env.RENEWAL_NOTIFICATION_CRON || "0 9 * * *";

cron.schedule(RENEWAL_NOTIFICATION_CRON, async () => {
  try {
    await processHandsetWeekRenewals();
  } catch (error) {
    logError("Handset 7-day renewal cron failed:", error);
  }
});

cron.schedule(RENEWAL_NOTIFICATION_CRON, async () => {
  try {
    await processHandsetRenewalsDueToday();
  } catch (error) {
    logError("Handset same-day renewal cron failed:", error);
  }
});

cron.schedule(RENEWAL_NOTIFICATION_CRON, async () => {
  try {
    await processContractWeekRenewals();
  } catch (error) {
    logError("Contract 7-day renewal cron failed:", error);
  }
});

cron.schedule(RENEWAL_NOTIFICATION_CRON, async () => {
  try {
    await processContractsExpiringToday();
  } catch (error) {
    logError("Contract same-day expiry cron failed:", error);
  }
});

// Notification emails: once daily at 09:05 (after renewal notifications at 09:00)
const NOTIFICATION_EMAIL_CRON =
  process.env.NOTIFICATION_EMAIL_CRON || "5 9 * * *";

cron.schedule(NOTIFICATION_EMAIL_CRON, async () => {
  try {
    await processNotificationEmails();
  } catch (error) {
    logError("Notification email cron failed:", error);
  }
});

const EVENT_NOTIFICATION_CRON =
  process.env.EVENT_NOTIFICATION_CRON || "* * * * *";

cron.schedule(EVENT_NOTIFICATION_CRON, async () => {
  try {
    await processDueEventNotifications();
    await processCalendarNotificationEmails();
  } catch (error) {
    logError("Calendar event notification cron failed:", error);
  }
});

cron.schedule('0 15,20 * * *', withSyncLock("device-costs", async () => {
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

    const formattedData = dedupeByKey(
      deviceCosts.map(device => ({
        device_name: device.device_name,
        amount: parseFloat(device.amount),
        device_group: device.device_group,
        staff_discounted_amount: parseFloat(device.staff_discounted_amount)
      })),
      (d) => `${d.device_name}|${d.device_group}`
    );

    await CdrLiveDeviceCost.bulkCreate(formattedData, { transaction });

    await transaction.commit();

    console.log("Device costs replaced successfully");

  } catch (error) {
    await transaction.rollback();
    logError("Device cost sync failed:", error);
  }
}));

cron.schedule('0 15,20 * * *', withSyncLock("employee-contracts", async () => {
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
    console.log(response)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const contractData = await response.json();
    console.log("hheeee: ",contractData)
    if (!Array.isArray(contractData) || contractData.length === 0) {
      throw new Error("Invalid or empty contract data");
    }

    await CdrLiveEmployeeContractDetails.destroy({
      where: {},
      truncate: true,
      transaction,
    });

    const toNumberOrZero = (value) => {
      if (value == null || typeof value === "object") return 0;
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const toPlanPeriodOrNull = (value) => {
      if (value == null || typeof value === "object") return null;
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      return Math.trunc(parsed);
    };

    const toStringOrEmpty = (value) => {
      if (value == null || typeof value === "object") return "";
      return String(value);
    };

    const toDateOrNull = (value) => {
      if (value == null || value === "" || typeof value === "object") return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const formattedData = dedupeByKey(
      contractData.map((c) => ({
        package: toStringOrEmpty(c.package),
        msisdn: toStringOrEmpty(c.msisdn),
        device: toStringOrEmpty(c.device),
        contract_duration: toNumberOrZero(c.contract_duration),
        plan_period: toPlanPeriodOrNull(c.plan_period),
        contract_start_date: toDateOrNull(c.contract_start_date),
        contract_end_date: toDateOrNull(c.contract_end_date),
        package_price: toNumberOrZero(c.package_price),
        device_initial_cost: toNumberOrZero(c.device_initial_cost),
        device_upfront_payment: toNumberOrZero(c.device_upfront_payment),
        device_payout_balance: toNumberOrZero(c.device_payout_balance),
        device_monthly_price: toNumberOrZero(c.device_monthly_price),
        serviceplan_monthly_price: toNumberOrZero(c.serviceplan_monthly_price),
        subscription_status: toStringOrEmpty(c.subscription_status),
        staff_msisdn: toStringOrEmpty(c.staff_msisdn),
        employee_code: toStringOrEmpty(c.employee_code).replace(/-/g, ""),
      })),
      (c) =>
        [
          c.msisdn,
          c.employee_code,
          c.package,
          c.device,
          dateKey(c.contract_start_date),
          dateKey(c.contract_end_date),
          c.subscription_status,
        ].join("|")
    );

    await CdrLiveEmployeeContractDetails.bulkCreate(formattedData, { transaction });

    await transaction.commit();

    console.log("Employee contract details updated successfully");

  } catch (error) {
    await transaction.rollback();
    logError("Employee contract sync failed:", error);
  }
}));

cron.schedule('0 15,20 * * *', withSyncLock("employee-details", async () => {
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

    const formattedData = dedupeByKey(
      employeeData.map((emp) => ({
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
      })),
      (e) => `${e.employee_code}|${e.msisdn}`
    );

    await CdrLiveEmployeeDetail.bulkCreate(formattedData, { transaction });

    await transaction.commit();

    console.log("Employee details updated successfully");

  } catch (error) {
    await transaction.rollback();
    logError("Employee details sync failed:", error);
  }
}));

cron.schedule('0 15,20 * * *', withSyncLock("employee-handsets", async () => {
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

    const formattedData = dedupeByKey(
      handsetData.map((h) => ({
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
      })),
      (h) => `${h.mr_number}|${h.employee_code}|${h.part_no}|${h.fixed_asset_code || ""}`
    );

    await CdrLiveEmployeeHandsetDetail.bulkCreate(formattedData, { transaction });

    await transaction.commit();

    console.log("Employee handset details updated successfully");

  } catch (error) {
    await transaction.rollback();
    logError("Employee handset sync failed:", error);
  }
}));


app.use(handleFileUploadError);
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
    logError("Error synchronizing database:", error);
  });

// Socket.IO event handling
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });

  socket.on("error", (error) => {
    logError("Socket error:", error);
  });
});
