import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "DELETE") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { id } = req.query;
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: "Missing or invalid entry_id" });
    }

    const result = await queryDatabase("CALL removeUser(?)", [Number(id)]);

    return res.status(200).json({
      status: 200,
      message: `User with entry_id ${id} removed successfully`,
      result,
    });
  } catch (error: any) {
    console.error("Error removing user:", error);
    return res.status(500).json({ message: error.message || "Error removing user" });
  }
}
