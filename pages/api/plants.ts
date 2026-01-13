import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../lib/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const action = body.action;

    if (req.method !== "POST") {
      return res.status(405).json({ status: 405, message: "Method not allowed" });
    }

    if (!action) {
      return res.status(400).json({ status: 400, message: "Missing action parameter" });
    }

    let raw: any;

    switch (action) {
      case "getPlants": {
        // Simple select, no stored procedure
        raw = await queryDatabase(
          "SELECT entry_id, plant_name FROM Plants ORDER BY plant_name ASC",
          []
        );
        // Direct rows
        return res.status(200).json({
          status: 200,
          message: "OK",
          data: raw,
        });
      }

      case "addPlant": {
        const { plant_name } = body;

        if (!plant_name) {
          return res
            .status(400)
            .json({ status: 400, message: "Missing plant_name" });
        }

        // Uses the stored procedure defined above
        raw = await queryDatabase("CALL addPlant(?)", [plant_name]);

        // unwrap procedure result
        const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
        const row = rows[0] || {};

        return res.status(200).json({
          status: row.status_code || 200,
          message: row.message || "OK",
        });
      }

      case "removePlant": {
        const { plant_id } = body;

        if (!plant_id) {
          return res
            .status(400)
            .json({ status: 400, message: "Missing plant_id" });
        }

        raw = await queryDatabase("CALL removePlant(?)", [plant_id]);

        const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
        const row = rows[0] || {};

        return res.status(200).json({
          status: row.status_code || 200,
          message: row.message || "OK",
        });
      }

      default:
        return res
          .status(400)
          .json({ status: 400, message: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error("Error in /api/plants:", err);
    return res
      .status(500)
      .json({ status: 500, message: err.message || "Server error" });
  }
}
