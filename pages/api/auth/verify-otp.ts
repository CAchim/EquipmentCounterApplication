import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../../lib/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ message: "Email and OTP are required" });

  try {
    await queryDatabase("CALL verifyPasswordResetOtp(?, ?)", [email, otp]);
    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (err: any) {
    console.error("verify-otp error:", err);

    if (err?.sqlState === "45000") {
      return res.status(400).json({ message: err.sqlMessage });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}
