const logger = require("../middlewares/errorLogger");
const { logError } = logger;
const Staff = require("../models/Staff");
const Notifications = require("../models/Notifications");
const SupportTicket = require("../models/SupportTicket");
const SupportTicketComment = require("../models/SupportTicketComment");
const AirtimeContractSubmission = require("../models/AirtimeContractSubmission");
const AirtimeSubmissionComment = require("../models/AirtimeSubmissionComment");
const HandsetContractSubmission = require("../models/HandsetContractSubmission");
const HandsetSubmissionComment = require("../models/HandsetSubmissionComment");
const { getSocketIo } = require("../config/socket");
const { notifySubmissionParties } = require("../middlewares/submissionNotify");
const {
  normalizeEmployeeCode,
  findStaffByEmployeeCode,
} = require("../utils/employeeCode");

async function notifyEmployeeInApp({ employeeCode, type, message }) {
  const staff = await findStaffByEmployeeCode(employeeCode);
  const canonicalEmployeeCode = staff?.EmployeeCode;
  if (!canonicalEmployeeCode) return null;

  const notification = await Notifications.create({
    EmployeeCode: canonicalEmployeeCode,
    Type: type,
    Message: message,
    Viewed: false,
    Created_At: new Date(),
    RecipientEmployeeCode: canonicalEmployeeCode,
  });

  const io = getSocketIo();
  if (io) {
    io.emit("notification", notification);
  }

  return notification;
}

async function enrichComments(comments) {
  const allEmployees = await Staff.findAll({
    attributes: ["EmployeeCode", "FullName"],
  });
  const employeeMap = Object.fromEntries(
    allEmployees.map((e) => [normalizeEmployeeCode(e.EmployeeCode), e])
  );

  return comments.map((row) => {
    const plain = row.toJSON ? row.toJSON() : row;
    const admin = employeeMap[normalizeEmployeeCode(plain.adminCode)];
    return {
      id: plain.id,
      message: plain.message,
      adminCode: plain.adminCode,
      adminName: admin?.FullName || plain.adminCode,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  });
}

function createListHandler({ model, parentKey, findParent }) {
  return async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Valid id is required." });
      }

      const parent = await findParent(id);
      if (!parent) {
        return res.status(404).json({ message: "Record not found." });
      }

      const comments = await model.findAll({
        where: { [parentKey]: id },
        order: [["createdAt", "ASC"]],
      });

      res.status(200).json({ comments: await enrichComments(comments) });
    } catch (error) {
      logError("Error listing admin comments:", error);
      res.status(500).json({ message: "Failed to fetch comments." });
    }
  };
}

function createPostHandler({
  model,
  parentKey,
  findParent,
  getEmployeeCode,
  notifyType,
  notifyLabel,
}) {
  return async (req, res) => {
    try {
      const id = Number(req.params.id);
      const message = String(req.body?.message || "").trim();
      const notifyEmployee = Boolean(req.body?.notifyEmployee);
      const adminCode = normalizeEmployeeCode(req.user?.EmployeeCode);

      if (!id) {
        return res.status(400).json({ message: "Valid id is required." });
      }
      if (!adminCode) {
        return res.status(401).json({ message: "Admin employee code is required." });
      }
      if (!message) {
        return res.status(400).json({ message: "Comment message is required." });
      }

      const parent = await findParent(id);
      if (!parent) {
        return res.status(404).json({ message: "Record not found." });
      }

      const comment = await model.create({
        [parentKey]: id,
        adminCode,
        message,
      });

      if (notifyEmployee) {
        const employeeCode = getEmployeeCode(parent);
        const admin = await findStaffByEmployeeCode(adminCode);
        const adminName = admin?.FullName || adminCode;
        const notifyMessage = `${notifyLabel} comment from ${adminName}:\n\n${message}`;

        try {
          if (notifyType === "ticket") {
            await notifyEmployeeInApp({
              employeeCode,
              type: "Support Ticket Comment",
              message: notifyMessage,
            });
          } else {
            await notifySubmissionParties({
              employeeCode,
              userType:
                notifyType === "airtime"
                  ? "Airtime Submission Comment"
                  : "Handset Submission Comment",
              userMessage: notifyMessage,
              adminType:
                notifyType === "airtime"
                  ? "Airtime Submission Comment (Admin)"
                  : "Handset Submission Comment (Admin)",
              adminMessage: `${adminName} commented on a ${
                notifyType === "airtime" ? "airtime" : "handset"
              } submission for ${employeeCode}.`,
              userEmailSubject: `${
                notifyType === "airtime" ? "Airtime" : "Handset"
              } submission — new comment`,
              adminEmailSubject: `Admin comment on ${notifyType} submission`,
              ccAdminsOnUserEmail: true,
            });
          }
        } catch (notifyError) {
          logError("Error notifying employee of admin comment:", notifyError);
        }
      }

      const [enriched] = await enrichComments([comment]);
      res.status(201).json({
        message: "Comment added successfully.",
        comment: enriched,
      });
    } catch (error) {
      logError("Error creating admin comment:", error);
      res.status(500).json({ message: "Failed to add comment." });
    }
  };
}

function buildStatusCommentMessage(currentStatus, nextStatus, customMessage) {
  const header = `Status: ${currentStatus} → ${nextStatus}`;
  const custom = String(customMessage || "").trim();
  return custom ? `${header}\n\n${custom}` : header;
}

async function saveStatusComment(model, parentKey, parentId, adminCode, currentStatus, nextStatus, customMessage) {
  return model.create({
    [parentKey]: parentId,
    adminCode,
    message: buildStatusCommentMessage(currentStatus, nextStatus, customMessage),
  });
}

exports.saveSupportTicketStatusComment = async ({
  ticketId,
  adminCode,
  currentStatus,
  nextStatus,
  customMessage,
}) =>
  saveStatusComment(
    SupportTicketComment,
    "ticketId",
    ticketId,
    adminCode,
    currentStatus,
    nextStatus,
    customMessage
  );

exports.saveAirtimeSubmissionStatusComment = async ({
  submissionId,
  adminCode,
  currentStatus,
  nextStatus,
  customMessage,
}) =>
  saveStatusComment(
    AirtimeSubmissionComment,
    "submissionId",
    submissionId,
    adminCode,
    currentStatus,
    nextStatus,
    customMessage
  );

exports.saveHandsetSubmissionStatusComment = async ({
  submissionId,
  adminCode,
  currentStatus,
  nextStatus,
  customMessage,
}) =>
  saveStatusComment(
    HandsetSubmissionComment,
    "submissionId",
    submissionId,
    adminCode,
    currentStatus,
    nextStatus,
    customMessage
  );

exports.getSupportTicketComments = createListHandler({
  model: SupportTicketComment,
  parentKey: "ticketId",
  findParent: (id) => SupportTicket.findByPk(id),
});

exports.createSupportTicketComment = createPostHandler({
  model: SupportTicketComment,
  parentKey: "ticketId",
  findParent: (id) => SupportTicket.findByPk(id),
  getEmployeeCode: (ticket) => ticket.employeeCode,
  notifyType: "ticket",
  notifyLabel: "Support ticket",
});

exports.getAirtimeSubmissionComments = createListHandler({
  model: AirtimeSubmissionComment,
  parentKey: "submissionId",
  findParent: (id) => AirtimeContractSubmission.findByPk(id),
});

exports.createAirtimeSubmissionComment = createPostHandler({
  model: AirtimeSubmissionComment,
  parentKey: "submissionId",
  findParent: (id) => AirtimeContractSubmission.findByPk(id),
  getEmployeeCode: (submission) => submission.employeeCode,
  notifyType: "airtime",
  notifyLabel: "Airtime submission",
});

exports.getHandsetSubmissionComments = createListHandler({
  model: HandsetSubmissionComment,
  parentKey: "submissionId",
  findParent: (id) => HandsetContractSubmission.findByPk(id),
});

exports.createHandsetSubmissionComment = createPostHandler({
  model: HandsetSubmissionComment,
  parentKey: "submissionId",
  findParent: (id) => HandsetContractSubmission.findByPk(id),
  getEmployeeCode: (submission) => submission.employeeCode,
  notifyType: "handset",
  notifyLabel: "Handset submission",
});
