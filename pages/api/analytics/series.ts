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

  const safeHours = Number.isFinite(hours) ? Math.max(1, Math.min(hours, 24 * 365)) : 168; // cap 365 days

  try {
    // Read from rollup table + bring limits from Projects (robust to any join mismatch)
    const rows: any = await queryDatabase(
      `
      SELECT
        DATE_FORMAT(ci.hour_ts, '%Y-%m-%d %H:00') AS sample_ts,
        ci.last_new AS contacts,
        COALESCE(p.warning_at, 0) AS warning_at,
        COALESCE(p.contacts_limit, 0) AS contacts_limit,
        COALESCE(p.resets, 0) AS resets
      FROM counter_increments_hourly ci
      LEFT JOIN Projects p
        ON p.fixture_plant = ci.fixture_plant
       AND p.adapter_code  = ci.adapter_code
       AND p.fixture_type  = ci.fixture_type
      WHERE ci.fixture_plant = ?
        AND ci.adapter_code = ?
        AND ci.fixture_type = ?
        AND ci.hour_ts >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY ci.hour_ts ASC
      `,
      [plant, adapter, fixture, safeHours]
    );

    // If no rollup data yet, return a single point from Projects (so UI doesn't feel "broken")
    if (!Array.isArray(rows) || rows.length === 0) {
      const proj: any = await queryDatabase(
        `
        SELECT contacts, warning_at, contacts_limit, resets
        FROM Projects
        WHERE fixture_plant = ? AND adapter_code = ? AND fixture_type = ?
        LIMIT 1
        `,
        [plant, adapter, fixture]
      );

      if (Array.isArray(proj) && proj.length) {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:00`;

        return res.status(200).json({
          ok: true,
          series: [
            {
              sample_ts: ts,
              contacts: Number(proj[0].contacts ?? 0),
              warning_at: Number(proj[0].warning_at ?? 0),
              contacts_limit: Number(proj[0].contacts_limit ?? 0),
              resets: Number(proj[0].resets ?? 0),
            },
          ],
        });
      }

      return res.status(200).json({ ok: true, series: [] });
    }

    // Ensure numeric fields are numeric (defensive)
    const normalized = rows.map((r: any) => ({
      sample_ts: String(r.sample_ts ?? ""),
      contacts: Number(r.contacts ?? 0),
      warning_at: Number(r.warning_at ?? 0),
      contacts_limit: Number(r.contacts_limit ?? 0),
      resets: Number(r.resets ?? 0),
    }));

    return res.status(200).json({ ok: true, series: normalized });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
