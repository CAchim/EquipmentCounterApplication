import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../../lib/database";
import { requireAnalyticsAuth } from "./_auth";

type ProbeRow = { part_number: string; qty: number };

function aggregateDemand(fixtures: { probes: ProbeRow[] }[]) {
  const agg = new Map<string, { part_number: string; total_qty: number; fixtures: number }>();

  for (const fx of fixtures) {
    const seen = new Set<string>();
    for (const p of fx.probes || []) {
      const pn = String(p.part_number ?? "").trim();
      const qty = Number(p.qty ?? 0);
      if (!pn || !Number.isFinite(qty) || qty <= 0) continue;

      const cur = agg.get(pn) ?? { part_number: pn, total_qty: 0, fixtures: 0 };
      cur.total_qty += qty;
      if (!seen.has(pn)) {
        cur.fixtures += 1;
        seen.add(pn);
      }
      agg.set(pn, cur);
    }
  }

  return Array.from(agg.values()).sort((a, b) => b.total_qty - a.total_qty);
}

async function getFixtureForecast(plant: string, adapter: string, fixture: string, lookback: number) {
  const rows: any = await queryDatabase("CALL getFixtureForecast(?,?,?,?)", [plant, adapter, fixture, lookback]);
  return Array.isArray(rows) ? (rows[0]?.[0] ?? null) : null;
}

async function getTestProbesForProject(plant: string, adapter: string, fixture: string): Promise<ProbeRow[]> {
  const rows: any = await queryDatabase("CALL getTestProbesForProject(?,?,?)", [adapter, fixture, plant]);
  const data = Array.isArray(rows) ? (rows[0] ?? []) : [];
  return (data as any[]).map((r) => ({
    part_number: String(r.part_number ?? r.partNumber ?? "").trim(),
    qty: Number(r.qty ?? r.quantity ?? 0),
  }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  const auth = await requireAnalyticsAuth(req, res);
  if (!auth.ok) return;

  const plantQ = String(req.query.plant ?? "").trim();
  const plant = auth.isAdmin ? (plantQ || auth.userPlant || "") : (auth.userPlant || "");
  const lookback = Number(req.query.lookback ?? 24);

  if (!plant) return res.status(400).json({ ok: false, message: "Missing plant" });

  const WEEK_HOURS = 168;
  const MONTH_HOURS = 720;

  try {
    const fixtures: any[] = await queryDatabase(
      `SELECT project_name, adapter_code, fixture_type, fixture_plant, contacts, contacts_limit, warning_at, resets, last_update
       FROM Projects
       WHERE fixture_plant = ?
       ORDER BY project_name, adapter_code, fixture_type`,
      [plant]
    );

    const weekList: any[] = [];
    const monthList: any[] = [];

    for (const fx of Array.isArray(fixtures) ? fixtures : []) {
      const adapter = String(fx.adapter_code ?? "").trim();
      const fixtureType = String(fx.fixture_type ?? "").trim();
      if (!adapter || !fixtureType) continue;

      const fc = await getFixtureForecast(plant, adapter, fixtureType, Number.isFinite(lookback) ? lookback : 24);
      const eta = fc?.eta_limit_hours;

      // only fixtures that have a valid ETA to LIMIT
      if (eta == null || !Number.isFinite(Number(eta))) continue;

      const etaNum = Number(eta);
      const probes = await getTestProbesForProject(plant, adapter, fixtureType);

      const obj = {
        project_name: fx.project_name ?? null,
        adapter_code: adapter,
        fixture_type: fixtureType,
        eta_limit_hours: etaNum,
        probes,
      };

      if (etaNum <= WEEK_HOURS) weekList.push(obj);
      if (etaNum <= MONTH_HOURS) monthList.push(obj);
    }

    return res.status(200).json({
      ok: true,
      plant,
      lookbackHours: Number.isFinite(lookback) ? lookback : 24,
      week: { horizonHours: WEEK_HOURS, fixtures: weekList, demandByPn: aggregateDemand(weekList) },
      month: { horizonHours: MONTH_HOURS, fixtures: monthList, demandByPn: aggregateDemand(monthList) },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
