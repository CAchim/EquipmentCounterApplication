import { EmailSender } from "./emailSender";
import queryDatabase from "../database";

import { otpEmailTemplate } from "./templates/otpEmail";
import { passwordChangedTemplate } from "./templates/passwordChangedEmail";
import { newUserWelcomeTemplate } from "./templates/newUserWelcome";
import { counterWarningTemplate } from "./templates/counterWarningEmail";
import { counterLimitTemplate } from "./templates/counterLimitEmail";
import { counterResetTemplate } from "./templates/counterResetEmail";
import {
  ownerChangedTemplate,
  ownerRemovedTemplate,
} from "./templates/ownerChangedEmail";
import { limitsChangedTemplate } from "./templates/limitsChangedEmail";
import { projectDeletedTemplate } from "./templates/projectDeletedEmail";

/* =========================================================
   Helper: log_email_event wrapper
   SP signature (11 args), assumed something like:

   CREATE PROCEDURE log_email_event(
     IN p_email_to      VARCHAR(255),
     IN p_subject       VARCHAR(255),
     IN p_adapter_code  VARCHAR(50),
     IN p_fixture_type  VARCHAR(50),
     IN p_fixture_plant VARCHAR(100),
     IN p_project_name  VARCHAR(255),
     IN p_issue_type    VARCHAR(50),
     IN p_sent_to_group VARCHAR(50),
     IN p_status        VARCHAR(50),
     IN p_error_message TEXT,
     IN p_triggered_by  VARCHAR(255)
   )
   ========================================================= */

type IssueType =
  | "RESET"
  | "LIMIT"
  | "WARNING"
  | "LIMIT_CHANGE"
  | "OWNER_CHANGE_NEW"
  | "OWNER_CHANGE_OLD"
  | "OTP"
  | "WELCOME"
  | "PW_CHANGED"
  | "PROJECT_DELETED";

type SentToGroup = "ADMIN" | "ENGINEER" | "OWNER" | "OTHER";

type TestProbeInfo = { partNumber: string; qty: number };


interface LogEmailParams {
  emailTo: string | null | undefined;
  subject: string;
  adapterCode?: string | null;
  fixtureType?: string | null;
  fixturePlant?: string | null;
  projectName?: string | null;
  issueType: IssueType;
  sentToGroup?: SentToGroup | null;
  status: "SENT" | "FAILED";
  errorMessage?: string | null;
  triggeredBy?: string | null;
}

async function logEmailEvent(params: LogEmailParams): Promise<void> {
  const {
    emailTo,
    subject,
    adapterCode,
    fixtureType,
    fixturePlant,
    projectName,
    issueType,
    sentToGroup,
    status,
    errorMessage,
    triggeredBy,
  } = params;

  const safeTo = emailTo ?? "";

  try {
    await queryDatabase(
      "CALL log_email_event(?,?,?,?,?,?,?,?,?,?,?)",
      [
        safeTo, // p_email_to
        subject, // p_subject
        adapterCode ?? null, // p_adapter_code
        fixtureType ?? null, // p_fixture_type
        fixturePlant ?? null, //p_fixture_plant
        projectName ?? null, // p_project_name
        issueType, // p_issue_type
        sentToGroup ?? null, // p_sent_to_group
        status, // p_status
        errorMessage ?? null, // p_error_message
        triggeredBy ?? null, // p_triggered_by
      ]
    );
  } catch (err) {
    console.error("[emailService] log_email_event error:", err);
  }
}

/* =========================================================
   1. OTP EMAIL
   ========================================================= */

/**
 * Send OTP email for password reset or login.
 */
export async function sendOtpEmail(
  to: string | null | undefined,
  otp: string,
  triggeredBy?: string | null
): Promise<boolean> {
  const emailer = new EmailSender();
  const subject = "Your One-Time Password (OTP)";
  const htmlContent = otpEmailTemplate(otp);

  console.log("[sendOtpEmail] Preparing to send OTP email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent);

  if (!result) {
    console.error("[sendOtpEmail] Failed to send OTP email to:", to);
  } else {
    console.log("[sendOtpEmail] OTP email sent successfully to:", to);
  }

  await logEmailEvent({
    emailTo: to,
    subject,
    adapterCode: null,
    fixtureType: null,
    fixturePlant: null,
    projectName: null,
    issueType: "OTP",
    sentToGroup: "OTHER",
    status: result ? "SENT" : "FAILED",
    errorMessage: result ? null : "Failed to send OTP email",
    triggeredBy: triggeredBy ?? null,
  });

  return result;
}

/* =========================================================
   2. PASSWORD CHANGED EMAIL
   ========================================================= */

/**
 * Send a confirmation email after the user successfully changes their password.
 */
export async function sendPasswordChangedEmail(
  to: string | null | undefined,
  firstName: string | null | undefined,
  triggeredBy?: string | null
): Promise<boolean> {
  const emailer = new EmailSender();
  const subject = "Your password has been changed";
  const htmlContent = passwordChangedTemplate(firstName ?? "");

  console.log("[sendPasswordChangedEmail] Preparing to send email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent);

  if (!result) {
    console.error(
      "[sendPasswordChangedEmail] Failed to send password-changed email to:",
      to
    );
  } else {
    console.log(
      "[sendPasswordChangedEmail] Password-changed email sent successfully to:",
      to
    );
  }

  await logEmailEvent({
    emailTo: to,
    subject,
    adapterCode: null,
    fixtureType: null,
    fixturePlant: null,
    projectName: null,
    issueType: "PW_CHANGED",
    sentToGroup: "OWNER",
    status: result ? "SENT" : "FAILED",
    errorMessage: result ? null : "Failed to send password-changed email",
    triggeredBy: triggeredBy ?? null,
  });

  return result;
}

/* =========================================================
   3. NEW USER WELCOME
   ========================================================= */

/**
 * Send a welcome email after an account is created.
 */
export async function sendNewUserWelcomeEmail(
  to: string | null | undefined,
  firstName: string | null | undefined,
  tempPassword: string,
  triggeredBy?: string | null
): Promise<boolean> {
  const emailer = new EmailSender();
  const subject = "Your Equipment Counter Application Account";
  const htmlContent = newUserWelcomeTemplate(
    firstName ?? "",
    to ?? "",
    tempPassword
  );

  console.log("[sendNewUserWelcomeEmail] Preparing to send email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent);

  if (!result) {
    console.error(
      "[sendNewUserWelcomeEmail] Failed to send welcome email to:",
      to
    );
  } else {
    console.log(
      "[sendNewUserWelcomeEmail] Welcome email sent successfully to:",
      to
    );
  }

  await logEmailEvent({
    emailTo: to,
    subject,
    adapterCode: null,
    fixtureType: null,
    fixturePlant: null,
    projectName: null,
    issueType: "WELCOME",
    sentToGroup: "OWNER",
    status: result ? "SENT" : "FAILED",
    errorMessage: result ? null : "Failed to send welcome email",
    triggeredBy: triggeredBy ?? null,
  });

  return result;
}

/* =========================================================
   4. WARNING EMAIL
   ========================================================= */

/**
 * Send warning email when contacts count passes the warning threshold.
 */
export async function sendCounterWarningEmail(params: {
  to: string | null | undefined;
  ownerName?: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  currentContacts: number;
  warningAt: number;
  limit: number;
  triggeredBy?: string;
  testProbes?: TestProbeInfo[];
  cc?: string[];
}): Promise<boolean> {
  const {
    to,
    ownerName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    currentContacts,
    warningAt,
    limit,
    triggeredBy,
    testProbes,
    cc,
  } = params;

  const emailer = new EmailSender();
  const subject = `Warning threshold reached for ${projectName} (${adapterCode}/${fixtureType})`;
  const htmlContent = counterWarningTemplate({
    firstName: ownerName ?? "",
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    currentContacts,
    warningAt,
    limit,
    testProbes: testProbes ?? [],
  });

  console.log("[sendCounterWarningEmail] Sending warning email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent, { cc });

  // Logging to DB (we already have logEmailEvent implemented earlier)
  try {
    await logEmailEvent({
      emailTo: to,
      subject,
      adapterCode,
      fixtureType,
      fixturePlant,
      projectName,
      issueType: "WARNING",
      sentToGroup: "OWNER",
      status: result ? "SENT" : "FAILED",
      errorMessage: result ? null : "Failed to send warning email",
      triggeredBy: triggeredBy || null,
    });
  } catch (err) {
    console.error("[emailService] log_email_event error (WARNING):", err);
  }

  if (!result) {
    console.error("[sendCounterWarningEmail] Failed to send email to:", to);
  }

  return result;
}

/* =========================================================
   5. LIMIT REACHED EMAIL
   ========================================================= */

/**
 * Send limit-reached email when contacts count >= limit.
 */
export async function sendCounterLimitEmail(params: {
  to: string | null | undefined;
  ownerName?: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  currentContacts: number;
  limit: number;
  triggeredBy?: string;
  testProbes?: TestProbeInfo[];
  cc?: string[];
}): Promise<boolean> {
  const {
    to,
    ownerName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    currentContacts,
    limit,
    triggeredBy,
    testProbes,
  } = params;

  const emailer = new EmailSender();
  const subject = `LIMIT REACHED for ${projectName} (${adapterCode}/${fixtureType})`;
  const htmlContent = counterLimitTemplate({
    firstName: ownerName ?? "",
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    currentContacts,
    limit,
    testProbes: testProbes ?? [],
  });

  console.log("[sendCounterLimitEmail] Sending limit email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent, { cc: params.cc });

  try {
    await logEmailEvent({
      emailTo: to,
      subject,
      adapterCode,
      fixtureType,
      fixturePlant,
      projectName,
      issueType: "LIMIT",
      sentToGroup: "OWNER",
      status: result ? "SENT" : "FAILED",
      errorMessage: result ? null : "Failed to send limit email",
      triggeredBy: triggeredBy || null,
    });
  } catch (err) {
    console.error("[emailService] log_email_event error (LIMIT):", err);
  }

  if (!result) {
    console.error("[sendCounterLimitEmail] Failed to send email to:", to);
  }

  return result;
}

/* =========================================================
   6. COUNTER RESET EMAIL
   ========================================================= */

/**
 * Send notification that the counter was reset.
 */
export async function sendCounterResetEmail(params: {
  to: string | null | undefined;
  ownerName?: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  performedBy: string; // who reset it
  oldContacts: number;
  triggeredBy?: string | null;
}): Promise<boolean> {
  const {
    to,
    ownerName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    performedBy,
    oldContacts,
    triggeredBy,
  } = params;

  const emailer = new EmailSender();
  const subject = `Counter reset for ${projectName} (${adapterCode}/${fixtureType})`;
  const htmlContent = counterResetTemplate({
    firstName: ownerName ?? "",
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    performedBy,
    oldContacts,
  });

  console.log("[sendCounterResetEmail] Sending reset email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent);

  if (!result) {
    console.error("[sendCounterResetEmail] Failed to send email to:", to);
  }

  await logEmailEvent({
    emailTo: to,
    subject,
    adapterCode,
    fixtureType,
    fixturePlant,
    projectName,
    issueType: "RESET",
    sentToGroup: "OWNER",
    status: result ? "SENT" : "FAILED",
    errorMessage: result ? null : "Failed to send reset email",
    triggeredBy: triggeredBy ?? null,
  });

  return result;
}

/* =========================================================
   7. OWNER CHANGE (NEW OWNER)
   ========================================================= */

/**
 * Send notification when project owner is changed (NEW owner).
 */
export async function sendOwnerChangedEmail(params: {
  to: string | null | undefined;
  newOwnerName?: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  oldOwnerEmail?: string | null;
  triggeredBy?: string | null;
}): Promise<boolean> {
  const {
    to,
    newOwnerName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    oldOwnerEmail,
    triggeredBy,
  } = params;

  const emailer = new EmailSender();
  const subject = `You are now owner of ${projectName} (${adapterCode}/${fixtureType})`;
  const htmlContent = ownerChangedTemplate({
    firstName: newOwnerName ?? "",
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    oldOwnerEmail: oldOwnerEmail ?? "",
  });

  console.log("[sendOwnerChangedEmail] Sending owner-changed email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent);

  if (!result) {
    console.error("[sendOwnerChangedEmail] Failed to send email to:", to);
  }

  await logEmailEvent({
    emailTo: to,
    subject,
    adapterCode,
    fixtureType,
    fixturePlant,
    projectName,
    issueType: "OWNER_CHANGE_NEW",
    sentToGroup: "OWNER",
    status: result ? "SENT" : "FAILED",
    errorMessage: result ? null : "Failed to send owner-changed email",
    triggeredBy: triggeredBy ?? null,
  });

  return result;
}

/* =========================================================
   8. OWNER REMOVED (OLD OWNER)
   ========================================================= */

/**
 * Send notification to the OLD owner ("you are no longer responsible...").
 */
export async function sendOwnerRemovedEmail(params: {
  to: string | null | undefined;
  oldOwnerName?: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  newOwnerEmail?: string | null;
  triggeredBy?: string | null;
}): Promise<boolean> {
  const {
    to,
    oldOwnerName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    newOwnerEmail,
    triggeredBy,
  } = params;

  const emailer = new EmailSender();
  const subject = `You are no longer owner of ${projectName} (${adapterCode}/${fixtureType})`;
  const htmlContent = ownerRemovedTemplate({
    firstName: oldOwnerName ?? "",
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    newOwnerEmail: newOwnerEmail ?? "",
  });

  console.log("[sendOwnerRemovedEmail] Sending owner-removed email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent);

  if (!result) {
    console.error("[sendOwnerRemovedEmail] Failed to send email to:", to);
  }

  await logEmailEvent({
    emailTo: to,
    subject,
    adapterCode,
    fixtureType,
    fixturePlant,
    projectName,
    issueType: "OWNER_CHANGE_OLD",
    sentToGroup: "OWNER",
    status: result ? "SENT" : "FAILED",
    errorMessage: result ? null : "Failed to send owner-removed email",
    triggeredBy: triggeredBy ?? null,
  });

  return result;
}

/* =========================================================
   9. LIMITS CHANGED EMAIL
   ========================================================= */

/**
 * Send notification when warning / limit values are changed.
 */
export async function sendLimitsChangedEmail(params: {
  to: string | null | undefined;
  ownerName?: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  oldWarningAt: number;
  oldLimit: number;
  newWarningAt: number;
  newLimit: number;
  triggeredBy?: string | null;
}): Promise<boolean> {
  const {
    to,
    ownerName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    oldWarningAt,
    oldLimit,
    newWarningAt,
    newLimit,
    triggeredBy,
  } = params;

  const emailer = new EmailSender();
  const subject = `Limits updated for ${projectName} (${adapterCode}/${fixtureType})`;
  const htmlContent = limitsChangedTemplate({
    firstName: ownerName ?? "",
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    oldWarningAt,
    oldLimit,
    newWarningAt,
    newLimit,
  });

  console.log("[sendLimitsChangedEmail] Sending limits-changed email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent);

  if (!result) {
    console.error("[sendLimitsChangedEmail] Failed to send email to:", to);
  }

  await logEmailEvent({
    emailTo: to,
    subject,
    adapterCode,
    fixtureType,
    fixturePlant,
    projectName,
    issueType: "LIMIT_CHANGE",
    sentToGroup: "OWNER",
    status: result ? "SENT" : "FAILED",
    errorMessage: result ? null : "Failed to send limits-changed email",
    triggeredBy: triggeredBy ?? null,
  });

  return result;
}

/* =========================================================
   10. PROJECT DELETED EMAIL
   ========================================================= */

/**
 * Send notification when a project/fixture is deleted.
 */
export async function sendProjectDeletedEmail(params: {
  to: string | null | undefined;
  firstName?: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  warningAt?: number | null;
  limit?: number | null;
  deletedBy: string;
  triggeredBy?: string | null;
}): Promise<boolean> {
  const {
    to,
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    warningAt,
    limit,
    deletedBy,
    triggeredBy,
  } = params;

  const emailer = new EmailSender();
  const subject = `Project deleted: ${projectName} (${adapterCode}/${fixtureType})`;

  const htmlContent = projectDeletedTemplate({
    firstName: firstName ?? "",
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    warningAt: warningAt ?? null,
    limit: limit ?? null,
    deletedBy,
  });

  console.log("[sendProjectDeletedEmail] Sending delete email to:", to);

  const result = await emailer.sendEmail(to, subject, htmlContent);

  if (!result) {
    console.error("[sendProjectDeletedEmail] Failed to send email to:", to);
  }

  await logEmailEvent({
    emailTo: to,
    subject,
    adapterCode,
    fixtureType,
    fixturePlant,
    projectName,
    issueType: "PROJECT_DELETED",
    sentToGroup: "OWNER",
    status: result ? "SENT" : "FAILED",
    errorMessage: result ? null : "Failed to send project-deleted email",
    triggeredBy: triggeredBy ?? null,
  });

  return result;
}
