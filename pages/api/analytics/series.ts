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
  const hours = Number(req.query.hours ?? 168);

  if (!plant || !adapter || !fixture) {
    return res.status(400).json({ ok: false, message: "Missing plant/adapter/fixture" });
  }

  try {
    const rows: any = await queryDatabase(
      `SELECT
         DATE_FORMAT(sample_ts, '%Y-%m-%d %H:00') AS sample_ts,
         contacts,
         warning_at,
         contacts_limit,
         resets
       FROM fixture_samples_hourly
       WHERE fixture_plant = ?
         AND adapter_code = ?
         AND fixture_type = ?
         AND sample_ts >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY sample_ts`,
      [plant, adapter, fixture, Number.isFinite(hours) ? hours : 168]
    );

    return res.status(200).json({ ok: true, series: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
