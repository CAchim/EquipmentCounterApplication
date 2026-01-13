import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { entry_id, first_name, last_name, user_id, email, user_group } = req.body;

  if (!entry_id || !first_name || !last_name || !user_id || !email || !user_group) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    //console.log("Editing user with data:", { entry_id, first_name, last_name, user_id, email, user_group });

    const raw = await queryDatabase("CALL editUser(?, ?, ?, ?, ?, ?)", [
      entry_id,
      first_name,
      last_name,
      user_id,
      email,
      user_group,
    ]);

    //console.log("DB result:", raw);

    // Normalize stored procedure result
    let status_code = 500;
    let message = "Unexpected DB response";

    if (Array.isArray(raw) && Array.isArray(raw[0]) && raw[0][0]) {
      status_code = raw[0][0].status_code || 500;
      message = raw[0][0].message || message;
    }

    // Send consistent response
    return res.status(200).json({ status_code, message });
  } catch (error) {
    console.error("Error editing user:", error);
    return res.status(500).json({ status_code: 500, message: "Error editing user", error });
  }
}
