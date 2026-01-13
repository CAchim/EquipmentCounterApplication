import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../../lib/database";
import { requireAnalyticsAuth } from "./_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  const auth = await requireAnalyticsAuth(req, res);
  if (!auth.ok) return;

  const plantQ = String(req.query.plant ?? "").trim();
  const plant = auth.isAdmin ? (plantQ || auth.userPlant || "") : (auth.userPlant || "");
  if (!plant) return res.status(400).json({ ok: false, message: "Missing plant" });

  try {
    const rows: any = await queryDatabase(
      `SELECT
         entry_id, project_name, adapter_code, fixture_type, fixture_plant,
         contacts, warning_at, contacts_limit, resets, last_update
       FROM Projects
       WHERE fixture_plant = ?
       ORDER BY project_name, adapter_code, fixture_type`,
      [plant]
    );

    return res.status(200).json({ ok: true, fixtures: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
