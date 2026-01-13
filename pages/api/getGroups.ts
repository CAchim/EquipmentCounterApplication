import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Accept GET with ?plant=… (and also POST body.plant just in case)
    const plant =
      typeof req.query.plant === "string"
        ? req.query.plant
        : (req.body?.plant as string | undefined);

    if (!plant) {
      return res.status(400).json({ message: "Missing 'plant' parameter" });
    }

    // Call stored procedure: fetchGroups(IN plant_nameParam VARCHAR(100))
    const raw = await queryDatabase("CALL fetchGroups(?)", [plant]);

    // Normalize possible shapes from serverless-mysql / mysql driver:
    // - For CALL: usually [rows, fields]
    // - Sometimes helper may already give just rows
    let rows: any[] = [];

    if (Array.isArray(raw)) {
      // CALL case: [rows, fields] or [rows]
      if (Array.isArray(raw[0])) {
        rows = raw[0]; // actual rows from stored procedure
      } else {
        rows = raw as any[];
      }
    }

    // rows should be array of objects with { group_name }
    const groups: string[] = Array.isArray(rows)
      ? rows
          .map((r) => r.group_name)
          .filter((g: any) => typeof g === "string" && g.trim().length > 0)
      : [];

    return res.status(200).json(groups);
  } catch (error: any) {
    console.error("Error fetching groups:", error);
    const message =
      error?.sqlMessage || error?.message || "Error fetching groups";
    return res.status(500).json({ message });
  }
}
