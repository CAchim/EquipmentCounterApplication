import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";
import bcrypt from "bcryptjs";
import { sendNewUserWelcomeEmail, sendPasswordChangedEmail} from "../../lib/email/emailService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  function generateTempPassword(): string {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$%";
    let result = "";
    for (let i = 0; i < 10; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
  
  const tempPassword = generateTempPassword();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const action = body?.action;

    if (!action) {
      return res
        .status(400)
        .json({ status: 400, message: "Missing action parameter" });
    }

    let raw: any;

    switch (action) {
      case "addUser": {
        const {
          first_name,
          last_name,
          user_id,
          email,
          user_plant,
          user_group,
        } = body;

        // Basic field validation
        if (
          !first_name ||
          !last_name ||
          !user_id ||
          !email ||
          !user_plant ||
          !user_group
        ) {
          return res.status(400).json({
            status: 400,
            message: "Missing required fields for addUser",
          });
        }
        // 1) Hash password with bcrypt
        const bcrypt = require("bcryptjs");
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // 2) Call addUser procedure with HASHED password
        raw = await queryDatabase("CALL addUser(?, ?, ?, ?, ?, ?, ?)", [
          first_name,
          last_name,
          user_id,
          email,
          hashedPassword,
          user_plant,
          user_group,
        ]);
        await sendNewUserWelcomeEmail(
          body.email,
          body.first_name,
          tempPassword
        );
        break;
      }

      case "changePassword": {
        const {
          user_email,
          user_password, // old password
          new_password,
          password_confirmation,
        } = body;

        if (
          !user_email ||
          !user_password ||
          !new_password ||
          !password_confirmation
        ) {
          return res.status(400).json({
            status: 400,
            message: "Missing required password change fields",
          });
        }

        if (new_password !== password_confirmation) {
          return res.status(400).json({
            status: 400,
            message: "New passwords do not match",
          });
        }

        // 1) Fetch user by email
        const rows: any = await queryDatabase(
          "SELECT entry_id, user_password, first_name FROM Users WHERE email = ? LIMIT 1",
          [user_email]
        );

        if (!Array.isArray(rows) || rows.length === 0) {
          return res.status(401).json({
            status: 401,
            message: "Invalid email or current password",
          });
        }

        const user = rows[0];

        // 2) Check old password with bcrypt
        const isValid = await bcrypt.compare(
          user_password,
          user.user_password
        );
        if (!isValid) {
          return res.status(401).json({
            status: 401,
            message: "Invalid email or current password",
          });
        }

        // 3) Hash new password
        const hashedNewPassword = await bcrypt.hash(new_password, 10);

        // 4) Update password in DB
        await queryDatabase(
          "UPDATE Users SET user_password = ?, must_change_password = 0 WHERE entry_id = ?",
          [hashedNewPassword, user.entry_id]
        );

        await sendPasswordChangedEmail(user_email, user.first_name);

        return res.status(200).json({
          status: 200,
          message: "Password changed successfully",
        });
      }

      case "getEmailByUserGroup": {
        const { group_name } = body;
        if (!group_name) {
          return res.status(400).json({
            status: 400,
            message: "Missing group_name",
          });
        }

        raw = await queryDatabase("CALL getEmailByUserGroup(?)", [group_name]);
        break;
      }

      default:
        return res
          .status(400)
          .json({ status: 400, message: `Unknown action: ${action}` });
    }

    // For actions that used stored procedures (addUser, getEmailByUserGroup)
    if (raw !== undefined) {
      const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
      const row = rows[0] || {};

      return res.status(200).json({
        status: row.status_code || 200,
        message: row.message || "OK",
        data: rows,
      });
    }

    // changePassword already returned above
  } catch (err: any) {
    console.error("Error in getUsers API:", err);

    // Duplicate user_id/email → 409
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        status: 409,
        message: "User ID or email already exists",
      });
    }

    return res
      .status(500)
      .json({ status: 500, message: err.message || "Server error" });
  }
}
