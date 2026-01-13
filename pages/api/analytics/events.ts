import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../../lib/database";
import { requireAnalyticsAuth } from "./_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  const auth = await requireAnalyticsAuth(req, res);
  if (!auth.ok) return;

  const plantQ = String(req.query.plant ?? "").trim();
  const plant = auth.isAdmin ? (plantQ || auth.userPlant || "") : (auth.userPlant || "");
  const adapter = String(req.query.adapter ?? "").trim();
  const fixture = String(req.query.fixture ?? "").trim();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

  if (!plant || !adapter || !fixture) {
    return res.status(400).json({ ok: false, message: "Missing plant/adapter/fixture" });
  }

  try {
    const rows: any = await queryDatabase(
      `SELECT entry_id, created_at, event_type, event_details, old_value, new_value, actor, project_name
       FROM fixture_events
       WHERE fixture_plant = ?
         AND adapter_code = ?
         AND fixture_type = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [plant, adapter, fixture, limit]
    );

    return res.status(200).json({ ok: true, events: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
