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
  const lookback = Number(req.query.lookback ?? 24);

  if (!plant || !adapter || !fixture) {
    return res.status(400).json({ ok: false, message: "Missing plant/adapter/fixture" });
  }

  try {
    const rows: any = await queryDatabase("CALL getFixtureForecast(?,?,?,?)", [
      plant,
      adapter,
      fixture,
      Number.isFinite(lookback) ? lookback : 24,
    ]);

    const data = Array.isArray(rows) ? (rows[0]?.[0] ?? null) : null;
    return res.status(200).json({ ok: true, forecast: data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
