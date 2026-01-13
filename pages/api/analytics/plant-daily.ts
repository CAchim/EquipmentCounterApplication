import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../../lib/database";
import { requireAnalyticsAuth } from "./_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  const auth = await requireAnalyticsAuth(req, res);
  if (!auth.ok) return;

  const plantQ = String(req.query.plant ?? "").trim();
  const plant = auth.isAdmin ? (plantQ || auth.userPlant || "") : (auth.userPlant || "");
  const days = Math.min(60, Math.max(1, Number(req.query.days ?? 14)));

  if (!plant) return res.status(400).json({ ok: false, message: "Missing plant" });

  try {
    const rows: any = await queryDatabase(
      `SELECT
         DATE(created_at) AS day,
         SUM(event_type='RESET') AS resets,
         SUM(event_type IN ('TP_CHANGED','TP_DELETED','TP_REMOVE_ALL')) AS tp_events
       FROM fixture_events
       WHERE fixture_plant = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY day DESC`,
      [plant, days]
    );

    return res.status(200).json({ ok: true, daily: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
