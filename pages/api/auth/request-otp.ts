import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../../lib/database";
import { sendOtpEmail } from "../../../lib/email/emailService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const rawEmail = req.body?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log("[request-otp] Generating OTP for:", email, "OTP:", otp);

    // Stored procedure handles user lookup + OTP insert
    await queryDatabase("CALL requestPasswordResetOtp(?, ?, ?)", [
      email,
      otp,
      expiresAt,
    ]);

    const sent = await sendOtpEmail(email, otp);
    if (!sent) {
      return res.status(500).json({ message: "Failed to send OTP" });
    }

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (err: any) {
    console.error("request-otp error:", err);

    // Custom error from stored procedure
    if (err?.sqlState === "45000") {
      return res.status(400).json({ message: err.sqlMessage });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}
