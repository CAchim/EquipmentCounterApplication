import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../../lib/database";
import { requireAnalyticsAuth } from "./_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  const auth = await requireAnalyticsAuth(req, res);
  if (!auth.ok) return;

  try {
    if (auth.isAdmin) {
      const rows: any = await queryDatabase(
        "SELECT entry_id, plant_name FROM Plants ORDER BY plant_name",
        []
      );
      return res.status(200).json({ ok: true, plants: Array.isArray(rows) ? rows : [] });
    }

    // engineer: only their plant
    const plant = auth.userPlant || "Timisoara";
    return res.status(200).json({ ok: true, plants: [{ entry_id: -1, plant_name: plant }] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
