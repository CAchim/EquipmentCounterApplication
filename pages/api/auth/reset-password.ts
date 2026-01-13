import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import queryDatabase from "../../../lib/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, newPassword, otp } = req.body;

  if (!email || !newPassword || !otp) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await queryDatabase("CALL resetPasswordWithOtp(?, ?, ?)", [
      email,
      hashedPassword,
      otp,
    ]);

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err: any) {
    console.error("reset-password error:", err);

    if (err?.sqlState === "45000") {
      return res.status(400).json({ message: err.sqlMessage });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}
