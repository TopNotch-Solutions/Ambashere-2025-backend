const multer = require("multer");
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");
const db = require("../config/database");
const logger = require("../middlewares/errorLogger");

// Configure multer to accept Excel and PDF files
const storage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only Excel and PDF files are allowed"), false);
    }
  },
}).single("file");

const upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileType = req.file.mimetype;

    if (fileType.includes("excel") || fileType.includes("spreadsheetml")) {
      await processExcel(req.file.buffer, res);
    } else if (fileType.includes("pdf")) {
      await processPDF(req.file.buffer, res);
    } else {
      return res.status(400).json({ message: "Unsupported file format" });
    }
  } catch (error) {
    logger.error("Error processing file:", error);
    res.status(500).json({
      message: "Failed to process file",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Function to process Excel files
const processExcel = async (buffer, res) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length === 0) {
    return res.status(400).json({ message: "Uploaded Excel file is empty" });
  }

  const columnNames = data.find(row => row.some(cell => cell !== null && cell !== ""));
  if (!columnNames) {
    return res.status(400).json({ message: "No column names found in Excel" });
  }

  await insertDataIntoDatabase(data.slice(1), columnNames, res);
};

// Function to process PDF files
const processPDF = async (buffer, res) => {
  const pdfData = await pdfParse(buffer);
  const text = pdfData.text;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ message: "Uploaded PDF file is empty" });
  }

  const rows = text.split("\n").map(row => row.trim()).filter(row => row !== "");
  const columnNames = rows[0].split(/\s{2,}/); // Split based on multiple spaces (assumption)
  const data = rows.slice(1).map(row => row.split(/\s{2,}/));

  await insertDataIntoDatabase(data, columnNames, res);
};

// Function to insert extracted data into the database
const insertDataIntoDatabase = async (data, columnNames, res) => {
  const columnMappings = {
    employees: {
      "Employee Code": "EmployeeCode",
      "Active/Inactive": "EmploymentStatus",
      "Full Names": "FirstName",
      "Surname": "LastName",
      "Joined Name & Surname": "FullName",
      "Position": "Position",
      "Post/Pre": "ServicePlan",
      "Cell number": "PhoneNumber",
      "Last Name": "LastName",
      "First Name": "FirstName",
      "Cellphone": "PhoneNumber",
      "Department": "Department",
    },
    airtimebenefits: {
      "Employee Code": "EmployeeCode",
      "Total Airtime Allowance": "AirtimeAmount",
    },
    contracts: {
      "Employee Code": "EmployeeCode",
      "Contract 1": "PackageName",
      "Contract 2": "PackageName",
      "Contract 3": "PackageName",
      "Contract 4": "PackageName",
      "Option MSISDN": "MSISDN",
    },
  };

  for (const row of data) {
    if (row.every(cell => cell === null || cell === "")) {
      continue; // Skip empty rows
    }

    const tableName = getTableName(columnNames, columnMappings);
    if (!tableName) {
      console.error("No table found for row:", row);
      continue;
    }

    const mappedColumns = Object.entries(columnMappings[tableName]).reduce((acc, [excelHeader, dbColumn]) => {
      const index = columnNames.indexOf(excelHeader);
      if (index !== -1 && row[index] !== undefined) {
        acc[dbColumn] = row[index];
      }
      return acc;
    }, {});

    if (Object.keys(mappedColumns).length === 0) {
      console.error("No valid data found for row:", row);
      continue;
    }

    const columns = Object.keys(mappedColumns);
    const values = Object.values(mappedColumns);
    const placeholders = values.map(() => "?").join(", ");

    const query = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

    try {
      await db.query(query, values);
    } catch (dbError) {
      console.error("Database insertion error:", dbError);
    }
  }

  res.status(200).json({ message: "File uploaded and data inserted into the database" });
};

// Function to determine the table name based on available columns
const getTableName = (columnNames, columnMappings) => {
  for (const [tableName, mappings] of Object.entries(columnMappings)) {
    if (Object.keys(mappings).some(header => columnNames.includes(header))) {
      return tableName;
    }
  }
  return null;
};

module.exports = { upload: [uploadMiddleware, upload] };
