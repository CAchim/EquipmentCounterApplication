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

type PeriodFixtureDemand = {
  project_name: string | null;
  adapter_code: string;
  fixture_type: string;
  resets: number;
  total_requested_qty: number;
  estimated_used_qty: number;
};

type MonthlyProbeDemand = {
  month: string;
  total_qty: number;
  resets: number;
  fixtures: number;
  part_numbers: number;
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
  mapper: (item: T) => Promise<R>,
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

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

function aggregateDemand(fixtures: { probes: ProbeRow[] }[]) {
  const agg = new Map<
    string,
    { part_number: string; total_qty: number; fixtures: number }
  >();

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

function aggregatePeriodDemand(
  fixtures: { probes: ProbeRow[]; resets: number }[],
  partNumberFilter = "",
) {
  const q = partNumberFilter.trim().toLowerCase();
  const agg = new Map<
    string,
    { part_number: string; total_qty: number; fixtures: number }
  >();

  for (const fx of fixtures) {
    const resets = Number(fx.resets ?? 0);
    if (!Number.isFinite(resets) || resets <= 0) continue;

    const seen = new Set<string>();
    for (const p of fx.probes || []) {
      const pn = String(p.part_number ?? "").trim();
      const qty = Number(p.qty ?? 0);
      if (!pn || !Number.isFinite(qty) || qty <= 0) continue;
      if (q && !pn.toLowerCase().includes(q)) continue;

      const cur = agg.get(pn) ?? { part_number: pn, total_qty: 0, fixtures: 0 };
      cur.total_qty += qty * resets;
      if (!seen.has(pn)) {
        cur.fixtures += 1;
        seen.add(pn);
      }
      agg.set(pn, cur);
    }
  }

  return Array.from(agg.values()).sort((a, b) => b.total_qty - a.total_qty);
}

function parseDateParam(value: unknown, fallback: Date) {
  const s = String(value ?? "").trim();
  if (!s) return fallback;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? fallback : d;
}

async function getFixtureForecast(
  plant: string,
  adapter: string,
  fixture: string,
  lookback: number,
) {
  const rows: any = await queryDatabase("CALL getFixtureForecast(?,?,?,?)", [
    plant,
    adapter,
    fixture,
    lookback,
  ]);
  return Array.isArray(rows) ? (rows[0]?.[0] ?? null) : null;
}

async function getTestProbesForProject(
  plant: string,
  adapter: string,
  fixture: string,
): Promise<ProbeRow[]> {
  const rows: any = await queryDatabase("CALL getTestProbesForProject(?,?,?)", [
    adapter,
    fixture,
    plant,
  ]);
  const data = Array.isArray(rows) ? (rows[0] ?? []) : [];
  return (data as any[]).map((r) => ({
    part_number: String(r.part_number ?? r.partNumber ?? "").trim(),
    qty: Number(r.qty ?? r.quantity ?? 0),
  }));
}

async function getMonthlyResetsByFixture(
  plant: string,
): Promise<Map<string, number>> {
  const rows: any = await queryDatabase(
    `SELECT adapter_code, fixture_type, SUM(event_type='RESET') AS current_month_resets
     FROM fixture_events
     WHERE fixture_plant = ?
       AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
     GROUP BY adapter_code, fixture_type`,
    [plant],
  );

  const map = new Map<string, number>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const key = `${String(row.adapter_code ?? "").trim()}||${String(row.fixture_type ?? "").trim()}`;
    map.set(key, Number(row.current_month_resets ?? 0));
  }
  return map;
}

async function getResetsByFixtureForPeriod(
  plant: string,
  startDate: string,
  endDate: string,
): Promise<Map<string, number>> {
  const rows: any = await queryDatabase(
    `SELECT adapter_code, fixture_type, COUNT(*) AS resets
     FROM fixture_events
     WHERE fixture_plant = ?
       AND event_type = 'RESET'
       AND created_at >= ?
       AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY adapter_code, fixture_type`,
    [plant, startDate, endDate],
  );

  const map = new Map<string, number>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const key = `${String(row.adapter_code ?? "").trim()}||${String(row.fixture_type ?? "").trim()}`;
    map.set(key, Number(row.resets ?? 0));
  }
  return map;
}

async function getMonthlyResetsByFixtureForPeriod(
  plant: string,
  startDate: string,
  endDate: string,
) {
  const rows: any = await queryDatabase(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, adapter_code, fixture_type, COUNT(*) AS resets
     FROM fixture_events
     WHERE fixture_plant = ?
       AND event_type = 'RESET'
       AND created_at >= ?
       AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY DATE_FORMAT(created_at, '%Y-%m'), adapter_code, fixture_type
     ORDER BY month ASC`,
    [plant, startDate, endDate],
  );

  return Array.isArray(rows) ? rows : [];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  const auth = await requireAnalyticsAuth(req, res);
  if (!auth.ok) return;

  const plantQ = String(req.query.plant ?? "").trim();
  const plant = auth.isAdmin
    ? plantQ || auth.userPlant || ""
    : auth.userPlant || "";
  const lookback = Number(req.query.lookback ?? 24);
  const selectedAdapter = String(req.query.adapter ?? "").trim();
  const selectedFixture = String(req.query.fixture ?? "").trim();
  const scope = String(req.query.scope ?? "plant").trim().toLowerCase();
  const periodScope = scope === "fixture" ? "fixture" : "plant";
  const partNumberFilter = String(req.query.partNumber ?? "").trim();

  const defaultEnd = new Date();
  const defaultStart = new Date(defaultEnd.getTime());
  defaultStart.setMonth(defaultStart.getMonth() - 5);
  defaultStart.setDate(1);

  const startDateObj = parseDateParam(req.query.start, defaultStart);
  const endDateObj = parseDateParam(req.query.end, defaultEnd);
  const startDate = startDateObj.toISOString().slice(0, 10);
  const endDate = endDateObj.toISOString().slice(0, 10);

  if (!plant)
    return res.status(400).json({ ok: false, message: "Missing plant" });
  if (startDate > endDate)
    return res.status(400).json({ ok: false, message: "Invalid date range" });

  const WEEK_HOURS = 168;
  const MONTH_HOURS = 720;

  try {
    const fixtures: any[] = await queryDatabase(
      `SELECT project_name, adapter_code, fixture_type, fixture_plant, contacts, contacts_limit, warning_at, resets, last_update
       FROM Projects
       WHERE fixture_plant = ?
       ORDER BY project_name, adapter_code, fixture_type`,
      [plant],
    );

    const monthResets = await getMonthlyResetsByFixture(plant);
    const periodResets = await getResetsByFixtureForPeriod(
      plant,
      startDate,
      endDate,
    );
    const monthlyResetRows = await getMonthlyResetsByFixtureForPeriod(
      plant,
      startDate,
      endDate,
    );
    const lookbackHours = Number.isFinite(lookback) ? lookback : 24;
    const validFixtures = (Array.isArray(fixtures) ? fixtures : []).filter(
      (fx) => {
        const adapter = String(fx.adapter_code ?? "").trim();
        const fixtureType = String(fx.fixture_type ?? "").trim();
        return adapter && fixtureType;
      },
    );

    const selectedFixtureKey = `${selectedAdapter}||${selectedFixture}`;

    const processedFixtures = await mapWithConcurrency<
      any,
      | (FixtureProcessingResult & {
          periodFixtureDemand: PeriodFixtureDemand | null;
          periodResets: number;
        })
      | null
    >(validFixtures, 4, async (fx) => {
      const adapter = String(fx.adapter_code ?? "").trim();
      const fixtureType = String(fx.fixture_type ?? "").trim();
      if (!adapter || !fixtureType) return null;

      const key = `${adapter}||${fixtureType}`;
      const currentMonthResets = Number(monthResets.get(key) ?? 0);
      const isSelectedFixture =
        selectedAdapter === adapter && selectedFixture === fixtureType;
      const includeInPeriod = periodScope === "plant" || isSelectedFixture;
      const selectedPeriodResets = includeInPeriod
        ? Number(periodResets.get(key) ?? 0)
        : 0;
      const fc = await getFixtureForecast(
        plant,
        adapter,
        fixtureType,
        lookbackHours,
      );
      const eta = fc?.eta_limit_hours;
      const isOverLimit =
        typeof fx.contacts_limit === "number" &&
        Number(fx.contacts_limit) > 0 &&
        Number(fx.contacts ?? 0) >= Number(fx.contacts_limit);
      const etaNum = Number.isFinite(Number(eta)) ? Number(eta) : null;
      const willHitWeek = etaNum != null && etaNum <= WEEK_HOURS;
      const willHitMonth = etaNum != null && etaNum <= MONTH_HOURS;
      const shouldFetchProbes =
        currentMonthResets > 0 ||
        selectedPeriodResets > 0 ||
        isSelectedFixture ||
        (periodScope === "plant" && (isOverLimit || willHitMonth));

      const probes: ProbeRow[] = shouldFetchProbes
        ? await getTestProbesForProject(plant, adapter, fixtureType)
        : [];

      const totalRequestedQty = probes.reduce(
        (sum, probe) => sum + (Number(probe.qty) || 0),
        0,
      );
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
        periodResets: selectedPeriodResets,
        periodFixtureDemand:
          selectedPeriodResets > 0 && totalRequestedQty > 0
            ? {
                project_name: fx.project_name ?? null,
                adapter_code: adapter,
                fixture_type: fixtureType,
                resets: selectedPeriodResets,
                total_requested_qty: totalRequestedQty,
                estimated_used_qty: selectedPeriodResets * totalRequestedQty,
              }
            : null,
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
    const periodFixtureDemand: PeriodFixtureDemand[] = [];
    const periodFixtureSource: { probes: ProbeRow[]; resets: number }[] = [];
    const fixtureProbeCache = new Map<string, ProbeRow[]>();

    for (const result of processedFixtures) {
      if (!result) continue;

      if (result.weekFixture) weekList.push(result.weekFixture);
      if (result.monthFixture) monthList.push(result.monthFixture);
      if (result.selectedFixtureDetail)
        selectedFixtureDetail = result.selectedFixtureDetail;
      if (result.periodFixtureDemand)
        periodFixtureDemand.push(result.periodFixtureDemand);
      if (result.periodResets > 0 && result.probes.length)
        periodFixtureSource.push({
          probes: result.probes,
          resets: result.periodResets,
        });

      if (result.probes.length) {
        const detailKey = result.selectedFixtureDetail
          ? `${result.selectedFixtureDetail.adapter_code}||${result.selectedFixtureDetail.fixture_type}`
          : null;
        if (detailKey) fixtureProbeCache.set(detailKey, result.probes);
      }

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

    const periodDemandByPn = aggregatePeriodDemand(
      periodFixtureSource,
      partNumberFilter,
    );
    const periodResetValues = periodScope === "fixture"
      ? [Number(periodResets.get(selectedFixtureKey) ?? 0)]
      : Array.from(periodResets.values());

    const periodSummary = {
      resets: periodResetValues.reduce(
        (acc, value) => acc + Number(value || 0),
        0,
      ),
      fixtures: periodFixtureDemand.length,
      part_numbers: periodDemandByPn.length,
      total_qty: periodDemandByPn.reduce(
        (acc, row) => acc + Number(row.total_qty || 0),
        0,
      ),
    };

    const monthlySource = new Map<
      string,
      { probes: ProbeRow[]; resets: number }[]
    >();
    for (const row of monthlyResetRows as any[]) {
      const adapter = String(row.adapter_code ?? "").trim();
      const fixtureType = String(row.fixture_type ?? "").trim();
      const key = `${adapter}||${fixtureType}`;
      if (periodScope === "fixture" && key !== selectedFixtureKey) continue;
      const probes =
        fixtureProbeCache.get(key) ??
        (await getTestProbesForProject(plant, adapter, fixtureType));
      fixtureProbeCache.set(key, probes);
      const month = String(row.month ?? "").trim();
      const resets = Number(row.resets ?? 0);
      if (!month || !resets || !probes.length) continue;
      const list = monthlySource.get(month) ?? [];
      list.push({ probes, resets });
      monthlySource.set(month, list);
    }

    const monthlyTrend: MonthlyProbeDemand[] = Array.from(
      monthlySource.entries(),
    )
      .map(([month, items]) => {
        const byPn = aggregatePeriodDemand(items, partNumberFilter);
        return {
          month,
          total_qty: byPn.reduce(
            (acc, row) => acc + Number(row.total_qty || 0),
            0,
          ),
          resets: items.reduce(
            (acc, item) => acc + Number(item.resets || 0),
            0,
          ),
          fixtures: items.length,
          part_numbers: byPn.length,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

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
      scope: periodScope,
      lookbackHours,
      dateRange: { startDate, endDate },
      currentMonthUsage,
      selectedFixture: selectedFixtureDetail,
      period: {
        summary: periodSummary,
        monthlyTrend,
        demandByPn: periodDemandByPn,
        fixtures: periodFixtureDemand.sort(
          (a, b) => b.estimated_used_qty - a.estimated_used_qty,
        ),
      },
      week: {
        horizonHours: WEEK_HOURS,
        fixtures: weekList,
        demandByPn: aggregateDemand(weekList),
      },
      month: {
        horizonHours: MONTH_HOURS,
        fixtures: monthList,
        demandByPn: aggregateDemand(monthList),
      },
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, message: e?.message || "Server error" });
  }
}
