import type { NextApiRequest, NextApiResponse } from "next";
import queryDatabase from "../../../lib/database";
import { requireAnalyticsAuth } from "./_auth";

type ProbeRow = { part_number: string; qty: number };
type FixtureInfo = {
  project_name: string | null;
  adapter_code: string;
  fixture_type: string;
  eta_limit_hours: number;
  contacts: number | null;
  warning_at: number | null;
  contacts_limit: number | null;
  resets: number | null;
  current_month_resets: number;
  probes: ProbeRow[];
};

type SelectedFixtureDetail = {
  project_name: string | null;
  adapter_code: string;
  fixture_type: string;
  current_month_resets: number;
  requested_test_probes: ProbeRow[];
  total_requested_qty: number;
  estimated_used_qty: number;
};

type UsageSummary = {
  plant_resets_this_month: number;
  fixtures_with_probe_requests: number;
  unique_part_numbers: number;
  total_requested_qty: number;
  estimated_used_qty: number;
};

type FixtureProcessingResult = {
  weekFixture: FixtureInfo | null;
  monthFixture: FixtureInfo | null;
  selectedFixtureDetail: SelectedFixtureDetail | null;
  currentMonthResets: number;
  totalRequestedQty: number;
  estimatedUsedQty: number;
  probes: ProbeRow[];
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

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

async function getMonthlyResetsByFixture(plant: string): Promise<Map<string, number>> {
  const rows: any = await queryDatabase(
    `SELECT adapter_code, fixture_type, SUM(event_type='RESET') AS current_month_resets
     FROM fixture_events
     WHERE fixture_plant = ?
       AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
     GROUP BY adapter_code, fixture_type`,
    [plant]
  );

  const map = new Map<string, number>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const key = `${String(row.adapter_code ?? "").trim()}||${String(row.fixture_type ?? "").trim()}`;
    map.set(key, Number(row.current_month_resets ?? 0));
  }
  return map;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  const auth = await requireAnalyticsAuth(req, res);
  if (!auth.ok) return;

  const plantQ = String(req.query.plant ?? "").trim();
  const plant = auth.isAdmin ? (plantQ || auth.userPlant || "") : (auth.userPlant || "");
  const lookback = Number(req.query.lookback ?? 24);
  const selectedAdapter = String(req.query.adapter ?? "").trim();
  const selectedFixture = String(req.query.fixture ?? "").trim();

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

    const monthResets = await getMonthlyResetsByFixture(plant);
    const lookbackHours = Number.isFinite(lookback) ? lookback : 24;
    const validFixtures = (Array.isArray(fixtures) ? fixtures : []).filter((fx) => {
      const adapter = String(fx.adapter_code ?? "").trim();
      const fixtureType = String(fx.fixture_type ?? "").trim();
      return adapter && fixtureType;
    });

    const processedFixtures = await mapWithConcurrency<any, FixtureProcessingResult | null>(validFixtures, 4, async (fx) => {
      const adapter = String(fx.adapter_code ?? "").trim();
      const fixtureType = String(fx.fixture_type ?? "").trim();
      if (!adapter || !fixtureType) return null;

      const key = `${adapter}||${fixtureType}`;
      const currentMonthResets = Number(monthResets.get(key) ?? 0);
      const isSelectedFixture = selectedAdapter === adapter && selectedFixture === fixtureType;
      const fc = await getFixtureForecast(plant, adapter, fixtureType, lookbackHours);
      const eta = fc?.eta_limit_hours;
      const isOverLimit = typeof fx.contacts_limit === "number" && Number(fx.contacts_limit) > 0 && Number(fx.contacts ?? 0) >= Number(fx.contacts_limit);
      const etaNum = Number.isFinite(Number(eta)) ? Number(eta) : null;
      const willHitWeek = etaNum != null && etaNum <= WEEK_HOURS;
      const willHitMonth = etaNum != null && etaNum <= MONTH_HOURS;
      const shouldFetchProbes = currentMonthResets > 0 || isSelectedFixture || isOverLimit || willHitMonth;

      const probes: ProbeRow[] = shouldFetchProbes
        ? await getTestProbesForProject(plant, adapter, fixtureType)
        : [];

      const totalRequestedQty = probes.reduce((sum, probe) => sum + (Number(probe.qty) || 0), 0);
      const estimatedUsedQty = currentMonthResets * totalRequestedQty;

      const obj: FixtureInfo = {
        project_name: fx.project_name ?? null,
        adapter_code: adapter,
        fixture_type: fixtureType,
        eta_limit_hours: etaNum ?? 0,
        contacts: Number(fx.contacts ?? 0),
        warning_at: Number(fx.warning_at ?? 0),
        contacts_limit: Number(fx.contacts_limit ?? 0),
        resets: Number(fx.resets ?? 0),
        current_month_resets: currentMonthResets,
        probes,
      };

      return {
        weekFixture: isOverLimit || willHitWeek ? obj : null,
        monthFixture: isOverLimit || willHitMonth ? obj : null,
        selectedFixtureDetail: isSelectedFixture
          ? {
              project_name: fx.project_name ?? null,
              adapter_code: adapter,
              fixture_type: fixtureType,
              current_month_resets: currentMonthResets,
              requested_test_probes: probes,
              total_requested_qty: totalRequestedQty,
              estimated_used_qty: estimatedUsedQty,
            }
          : null,
        currentMonthResets,
        totalRequestedQty,
        estimatedUsedQty,
        probes,
      };
    });

    const weekList: FixtureInfo[] = [];
    const monthList: FixtureInfo[] = [];
    const usagePartNumbers = new Set<string>();

    let currentMonthResetsTotal = 0;
    let currentMonthRequestedQtyTotal = 0;
    let currentMonthEstimatedUsedQtyTotal = 0;
    let fixturesWithProbeRequests = 0;
    let selectedFixtureDetail: SelectedFixtureDetail | null = null;

    for (const result of processedFixtures) {
      if (!result) continue;

      if (result.weekFixture) weekList.push(result.weekFixture);
      if (result.monthFixture) monthList.push(result.monthFixture);
      if (result.selectedFixtureDetail) selectedFixtureDetail = result.selectedFixtureDetail;

      if (result.currentMonthResets > 0 && result.totalRequestedQty > 0) {
        fixturesWithProbeRequests += 1;
        currentMonthResetsTotal += result.currentMonthResets;
        currentMonthRequestedQtyTotal += result.totalRequestedQty;
        currentMonthEstimatedUsedQtyTotal += result.estimatedUsedQty;
        for (const probe of result.probes) {
          const pn = String(probe.part_number ?? "").trim();
          if (pn) usagePartNumbers.add(pn);
        }
      }
    }

    const currentMonthUsage: UsageSummary = {
      plant_resets_this_month: currentMonthResetsTotal,
      fixtures_with_probe_requests: fixturesWithProbeRequests,
      unique_part_numbers: usagePartNumbers.size,
      total_requested_qty: currentMonthRequestedQtyTotal,
      estimated_used_qty: currentMonthEstimatedUsedQtyTotal,
    };

    return res.status(200).json({
      ok: true,
      plant,
      lookbackHours,
      currentMonthUsage,
      selectedFixture: selectedFixtureDetail,
      week: { horizonHours: WEEK_HOURS, fixtures: weekList, demandByPn: aggregateDemand(weekList) },
      month: { horizonHours: MONTH_HOURS, fixtures: monthList, demandByPn: aggregateDemand(monthList) },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}
