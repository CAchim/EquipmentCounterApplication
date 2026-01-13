import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const raw = await queryDatabase<any>("CALL fetchPlants()");
    const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching plants:", error);
    res.status(500).json({ message: "Error fetching plants" });
  }
}
