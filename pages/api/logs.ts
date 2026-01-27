import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import queryDatabase from "../../lib/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ status: 405, message: "Method not allowed" });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const action = body.action;

    if (!action) {
      return res
        .status(400)
        .json({ status: 400, message: "Missing action parameter" });
    }

    // 🔹 NextAuth v4 pages router: (req, res, authOptions)
    const session: any = await getServerSession(req, res, authOptions as any);

    if (!session) {
      return res.status(401).json({ status: 401, message: "Unauthorized" });
    }

    const user = session.user || {};
    const userGroup = String(user.user_group || "").trim().toLowerCase();
    const isAdmin = userGroup === "admin";

    // optional plant filter coming from frontend (navbar plant selector)
    const requestedPlantRaw = String(body.fixture_plant || body.plant || "");
    const requestedPlant = requestedPlantRaw.trim() || null;

    // plant coming from session (normalized user)
    const sessionPlantRaw = String(
      user.fixture_plant || user.plant_name || ""
    );
    const sessionPlant = sessionPlantRaw.trim() || null;

    let raw: any;

    switch (action) {
      case "getLogs": {
        /**
         * Effective plant rules:
         * - Admin:
         *    - if requestedPlant is provided -> filter by plant
         *    - else -> show all logs
         * - Non-admin:
         *    - ALWAYS restricted to a plant
         *    - prefer sessionPlant
         *    - fallback to requestedPlant (so this page behaves like others)
         */
        const effectivePlant = isAdmin
          ? requestedPlant
          : sessionPlant || requestedPlant;

        if (!isAdmin && !effectivePlant) {
          return res.status(400).json({
            status: 400,
            message:
              "Missing plant for non-admin user (fixture_plant/plant_name not in session and no plant provided).",
          });
        }

        if (isAdmin) {
          if (effectivePlant) {
            raw = await queryDatabase(
              "SELECT * FROM db_logs WHERE fixture_plant = ? ORDER BY entry_id DESC",
              [effectivePlant]
            );
          } else {
            raw = await queryDatabase(
              "SELECT * FROM db_logs ORDER BY entry_id DESC",
              []
            );
          }
        } else {
          raw = await queryDatabase(
            "SELECT * FROM db_logs WHERE fixture_plant = ? ORDER BY entry_id DESC",
            [effectivePlant]
          );
        }

        return res.status(200).json({
          status: 200,
          message: "OK",
          data: raw,
        });
      }

      case "getLogDetails": {
        /**
         * Fetch extra analytics info from fixture_events for a given log row.
         * We match by fixture_plant + adapter_code + fixture_type and
         * simply return the last few events for that equipment.
         */

        const adapterCode: string | null =
          body.adapter_code || body.adapterCode || null;
        const fixtureType: string | null =
          body.fixture_type || body.fixtureType || null;
        const logPlantFromRow: string | null =
          body.fixture_plant || body.plant || null;

        if (!adapterCode || !fixtureType) {
          return res.status(400).json({
            status: 400,
            message: "Missing adapter_code or fixture_type for log details",
          });
        }

        // Effective plant rules similar to getLogs:
        const effectivePlant = isAdmin
          ? (logPlantFromRow || requestedPlant)
          : sessionPlant || logPlantFromRow || requestedPlant;

        if (!isAdmin && !effectivePlant) {
          return res.status(400).json({
            status: 400,
            message:
              "Missing plant for non-admin user when fetching log details.",
          });
        }

        const params: any[] = [adapterCode, fixtureType];
        let sql = `
          SELECT
            fe.entry_id,
            fe.fixture_plant,
            fe.adapter_code,
            fe.fixture_type,
            fe.project_name,
            fe.event_type,
            fe.event_details,
            fe.old_value,
            fe.new_value,
            fe.actor,
            fe.created_at
          FROM fixture_events fe
          WHERE fe.adapter_code = ?
            AND fe.fixture_type = ?
        `;

        if (effectivePlant) {
          sql += " AND fe.fixture_plant = ?";
          params.push(effectivePlant);
        }

        sql += " ORDER BY fe.created_at DESC, fe.entry_id DESC LIMIT 10";

        const events = await queryDatabase(sql, params);

        return res.status(200).json({
          status: 200,
          message: "OK",
          data: events,
        });
      }

      default:
        return res
          .status(400)
          .json({ status: 400, message: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error("Error in /api/logs:", err);
    return res
      .status(500)
      .json({ status: 500, message: err.message || "Server error" });
  }
}
