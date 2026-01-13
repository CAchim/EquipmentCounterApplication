import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { plant } = req.query;

  if (!plant || typeof plant !== "string") {
    return res.status(400).json({ message: "plant is required" });
  }

  try {
    const result = await queryDatabase("CALL fetchUsersByPlant(?)", [plant]);
    // MySQL CALL returns [rows, fields], so take the first element
    res.status(200).json(result[0]);
  } catch (error) {
    console.error("Error fetching users by plant:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
}
