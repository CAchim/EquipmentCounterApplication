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
        const effectivePlant = isAdmin ? requestedPlant : sessionPlant || requestedPlant;

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
