/**
 * Creates admin comment tables for support tickets, airtime submissions,
 * and handset submissions.
 * Run: node -e "require('./migrations/create_admin_comments').up().then(()=>process.exit(0))"
 */
const sequelize = require("../config/database");

const tables = [
  `CREATE TABLE IF NOT EXISTS support_ticket_comments (
      id INT NOT NULL AUTO_INCREMENT,
      ticketId INT NOT NULL,
      adminCode VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_support_ticket_comments_ticket (ticketId),
      CONSTRAINT fk_support_ticket_comments_ticket
        FOREIGN KEY (ticketId) REFERENCES support_tickets(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS airtime_submission_comments (
      id INT NOT NULL AUTO_INCREMENT,
      submissionId INT NOT NULL,
      adminCode VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_airtime_submission_comments_submission (submissionId),
      CONSTRAINT fk_airtime_submission_comments_submission
        FOREIGN KEY (submissionId) REFERENCES airtime_contract_submissions(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS handset_submission_comments (
      id INT NOT NULL AUTO_INCREMENT,
      submissionId INT NOT NULL,
      adminCode VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_handset_submission_comments_submission (submissionId),
      CONSTRAINT fk_handset_submission_comments_submission
        FOREIGN KEY (submissionId) REFERENCES handset_contract_submissions(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function up() {
  for (const sql of tables) {
    await sequelize.query(sql);
    console.log("OK:", sql.split("(")[0].trim());
  }
}

async function down() {
  await sequelize.query("DROP TABLE IF EXISTS support_ticket_comments");
  await sequelize.query("DROP TABLE IF EXISTS airtime_submission_comments");
  await sequelize.query("DROP TABLE IF EXISTS handset_submission_comments");
}

module.exports = { up, down };
