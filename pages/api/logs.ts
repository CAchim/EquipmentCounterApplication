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

    // 🔹 Important: cast authOptions to any for TS, and cast session as any
    const session: any = await getServerSession(
      req,
      res,
      authOptions as any
    );

    if (!session) {
      return res.status(401).json({ status: 401, message: "Unauthorized" });
    }

    const user = session.user || {};
    const userGroup = (user.user_group || "").toString().toLowerCase();

    // from Users/session (normalized in auth): e.g. "Arad", "Munich", etc.
    const userFixturePlant: string | null =
      (user.fixture_plant as string) || null;

    // optional plant filter coming from frontend (navbar plant selector)
    const requestedPlantRaw: string =
      (body.fixture_plant || body.plant || "").toString();
    const requestedPlant = requestedPlantRaw.trim() || null;

    let raw: any;

    switch (action) {
      case "getLogs": {
        const isAdmin = userGroup === "admin";

        if (isAdmin) {
          // 🔹 Admin:
          // - if a plant is selected in navbar -> filter by that plant
          // - if "Show all" (empty) -> show all plants
          if (requestedPlant) {
            raw = await queryDatabase(
              "SELECT * FROM db_logs WHERE fixture_plant = ? ORDER BY entry_id DESC",
              [requestedPlant]
            );
          } else {
            raw = await queryDatabase(
              "SELECT * FROM db_logs ORDER BY entry_id DESC",
              []
            );
          }
        } else {
          // 🔹 Non-admin: always restricted to their own fixture_plant
          if (!userFixturePlant) {
            return res.status(400).json({
              status: 400,
              message: "Missing fixture_plant on user session",
            });
          }

          raw = await queryDatabase(
            "SELECT * FROM db_logs WHERE fixture_plant = ? ORDER BY entry_id DESC",
            [userFixturePlant]
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
