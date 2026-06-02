import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
  ssr: false,
});
const ComposedChart = dynamic(
  () => import("recharts").then((m) => m.ComposedChart),
  {
    ssr: false,
  },
);
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false },
);
const ReferenceLine = dynamic(
  () => import("recharts").then((m) => m.ReferenceLine),
  { ssr: false },
);
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), {
  ssr: false,
});

type Plant = { entry_id: number; plant_name: string };

type Fixture = {
  entry_id: number;
  project_name: string;
  adapter_code: string;
  fixture_type: string;
  fixture_plant: string;
  contacts: number;
  warning_at: number;
  contacts_limit: number;
  resets: number;
  last_update: string | null;
};

type ForecastRow = {
  window_start: string;
  window_end: string;
  current_contacts: number;
  warning_at: number | null;
  contacts_limit: number | null;
  avg_contacts_per_hour: number;
  eta_warning_hours: number | null;
  eta_limit_hours: number | null;
  // Optional if you add them later:
  // buckets_used?: number | null;
  // hours_with_data?: number | null;
};

type SeriesPoint = {
  sample_ts: string;
  contacts: number;
  warning_at: number;
  contacts_limit: number;
  resets: number;
};

type ProbeRow = {
  part_number: string;
  qty: number;
};

type EventRow = {
  entry_id: number;
  created_at: string;
  event_type: string;
  event_details: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: string | null;
  project_name: string | null;
};

type DailyRow = { day: string; resets: number; tp_events: number };
type DemandAggRow = {
  part_number: string;
  total_qty: number;
  fixtures: number;
};
type ProbePeriodSummary = {
  resets: number;
  fixtures: number;
  part_numbers: number;
  total_qty: number;
};
type ProbeMonthlyTrendRow = {
  month: string;
  total_qty: number;
  resets: number;
  fixtures: number;
  part_numbers: number;
};
type ProbeFixtureDemandRow = {
  project_name: string | null;
  adapter_code: string;
  fixture_type: string;
  resets: number;
  total_requested_qty: number;
  estimated_used_qty: number;
};

type ProbeDemandUsageSummary = {
  plant_resets_this_month: number;
  fixtures_with_probe_requests: number;
  unique_part_numbers: number;
  total_requested_qty: number;
  estimated_used_qty: number;
};

type SelectedFixtureProbeDetail = {
  project_name: string | null;
  adapter_code: string;
  fixture_type: string;
  current_month_resets: number;
  requested_test_probes: ProbeRow[];
  total_requested_qty: number;
  estimated_used_qty: number;
};

type SortKey =
  | "created_at"
  | "event_type"
  | "actor"
  | "old_value"
  | "new_value"
  | "event_details";
type SortDir = "asc" | "desc";
type TabKey = "overview" | "planner" | "trends" | "probe" | "events";

function fmtHours(h: number | null | undefined) {
  if (h == null || !Number.isFinite(h)) return "—";
  if (h <= 0) return "0h";
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function fmtDateTime(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRate(r: number | null | undefined) {
  if (r == null || !Number.isFinite(r)) return "—";
  return `${r.toFixed(2)}/h`;
}

function safeStr(v: any) {
  return typeof v === "string" ? v : String(v ?? "");
}

function splitDateTime(ts: string) {
  const s = safeStr(ts);
  const m = s.replace("T", " ").split(".");
  const base = m[0];
  const parts = base.split(" ");
  if (parts.length >= 2) return { date: parts[0], time: parts[1] };
  return { date: base, time: "" };
}

function parseChartTsToDate(sample_ts: string) {
  // sample_ts comes like "YYYY-MM-DD HH:00"
  // convert to ISO-ish for Date parsing
  const s = safeStr(sample_ts).replace(" ", "T");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Robust fetch JSON */
async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const ct = r.headers.get("content-type") || "";
  const text = await r.text();

  if (!r.ok) {
    const msg = text?.slice(0, 200) || `${r.status} ${r.statusText}`;
    throw new Error(`HTTP ${r.status} for ${url}: ${msg}`);
  }
  if (!ct.includes("application/json")) {
    throw new Error(`Non-JSON response for ${url}: ${text?.slice(0, 80)}...`);
  }
  return JSON.parse(text) as T;
}

/** Measure element size with ResizeObserver (used for explicit LineChart width/height) */
function useMeasuredSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.floor(cr.width);
      const h = Math.floor(cr.height);
      // guard
      if (w <= 0 || h <= 0) return;
      setSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h },
      );
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}

// --- Event coloring / legend ---
type ActionKey =
  | "LIMIT_CHANGE"
  | "OWNER_CHANGE"
  | "CONTACTS_UPDATED"
  | "COUNTER_RESET"
  | "TP_CHANGE"
  | "OTHER";

function classifyEventType(raw: string): ActionKey {
  const t = String(raw ?? "").toUpperCase();

  if (t.includes("LIMIT") || t.includes("WARNING")) return "LIMIT_CHANGE";
  if (t.includes("OWNER")) return "OWNER_CHANGE";
  if (
    t.includes("CONTACT") ||
    t.includes("INCREMENT") ||
    t.includes("COUNTER_INC")
  )
    return "CONTACTS_UPDATED";
  if (t.includes("RESET")) return "COUNTER_RESET";
  if (t.includes("TP") || t.includes("PROBE")) return "TP_CHANGE";

  return "OTHER";
}

const ACTION_UI: Record<
  ActionKey,
  { label: string; bg: string; border: string }
> = {
  LIMIT_CHANGE: {
    label: "Limit",
    bg: "rgba(255, 193, 7, 0.22)",
    border: "rgba(255,193,7,0.35)",
  },
  OWNER_CHANGE: {
    label: "Owner",
    bg: "rgba(13, 110, 253, 0.18)",
    border: "rgba(13,110,253,0.32)",
  },
  CONTACTS_UPDATED: {
    label: "Contacts",
    bg: "rgba(25, 135, 84, 0.18)",
    border: "rgba(25,135,84,0.32)",
  },
  COUNTER_RESET: {
    label: "Reset",
    bg: "rgba(220, 53, 69, 0.18)",
    border: "rgba(220,53,69,0.32)",
  },
  TP_CHANGE: {
    label: "Test Probes",
    bg: "rgba(111, 66, 193, 0.18)",
    border: "rgba(111,66,193,0.32)",
  },
  OTHER: {
    label: "Other",
    bg: "rgba(255,255,255,0.10)",
    border: "rgba(255,255,255,0.18)",
  },
};

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<string>("Timisoara");

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedFixtureKey, setSelectedFixtureKey] = useState<string>("");

  // Search + stable dropdown
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [fixtureSearchDebounced, setFixtureSearchDebounced] = useState("");
  const fixtureSearchRef = useRef<HTMLInputElement | null>(null);

  const [lookbackHours, setLookbackHours] = useState<number>(24);
  const [seriesHours, setSeriesHours] = useState<number>(168);

  const [forecast, setForecast] = useState<ForecastRow | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [demandWeek, setDemandWeek] = useState<DemandAggRow[]>([]);
  const [demandMonth, setDemandMonth] = useState<DemandAggRow[]>([]);
  const [probeDemandSummary, setProbeDemandSummary] =
    useState<ProbeDemandUsageSummary | null>(null);
  const [selectedFixtureProbeInfo, setSelectedFixtureProbeInfo] =
    useState<SelectedFixtureProbeDetail | null>(null);
  const [probePeriodSummary, setProbePeriodSummary] =
    useState<ProbePeriodSummary | null>(null);
  const [probePeriodDemand, setProbePeriodDemand] = useState<DemandAggRow[]>(
    [],
  );
  const [probeMonthlyTrend, setProbeMonthlyTrend] = useState<
    ProbeMonthlyTrendRow[]
  >([]);
  const [probeFixtureDemand, setProbeFixtureDemand] = useState<
    ProbeFixtureDemandRow[]
  >([]);

  const defaultProbeEnd = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );
  const defaultProbeStart = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, []);
  const [probeStartDate, setProbeStartDate] =
    useState<string>(defaultProbeStart);
  const [probeEndDate, setProbeEndDate] = useState<string>(defaultProbeEnd);
  const [probePartSearch, setProbePartSearch] = useState<string>("");

  const demandSummary = useMemo(() => {
    const sum = (rows: DemandAggRow[]) => ({
      partNumbers: rows.length,
      totalQty: rows.reduce((acc, row) => acc + Number(row.total_qty ?? 0), 0),
    });
    return {
      week: sum(demandWeek),
      month: sum(demandMonth),
    };
  }, [demandWeek, demandMonth]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [eventSortKey, setEventSortKey] = useState<SortKey>("created_at");
  const [eventSortDir, setEventSortDir] = useState<SortDir>("desc");

  const [lastLoadedAt, setLastLoadedAt] = useState<string>("");

  // Chart toggles
  const [showDeltaLine, setShowDeltaLine] = useState<boolean>(true);

  // Tabs
  const [tab, setTab] = useState<TabKey>("overview");

  // Events filter chips
  const [eventFilter, setEventFilter] = useState<ActionKey | "ALL">("ALL");

  // Measured chart containers (explicit chart width/height)
  const chartBox = useMeasuredSize<HTMLDivElement>();
  const probeChartBox = useMeasuredSize<HTMLDivElement>();
  const fixturesRequestSeq = useRef(0);
  const analyticsRequestSeq = useRef(0);

  useEffect(() => setMounted(true), []);

  // Debounce fixture search
  useEffect(() => {
    const t = setTimeout(
      () => setFixtureSearchDebounced(fixtureSearch.trim()),
      160,
    );
    return () => clearTimeout(t);
  }, [fixtureSearch]);

  // "/" focuses search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      if (e.key === "/" && !isTypingField) {
        e.preventDefault();
        fixtureSearchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Load plants
  useEffect(() => {
    (async () => {
      try {
        const j = await fetchJson<{ plants: Plant[] }>("/api/analytics/plants");
        const list = Array.isArray(j.plants) ? j.plants : [];
        setPlants(list);

        const firstPlant = list[0]?.plant_name;
        setSelectedPlant((current) => {
          if (!firstPlant) return current;
          return list.some((p) => p.plant_name === current)
            ? current
            : firstPlant;
        });
      } catch (e: any) {
        console.error(e);
        setPlants([]);
      }
    })();
  }, []);

  // Load fixtures for plant
  useEffect(() => {
    if (!selectedPlant) return;
    const controller = new AbortController();
    const requestId = ++fixturesRequestSeq.current;
    setErr(null);

    (async () => {
      try {
        const j = await fetchJson<{ fixtures: Fixture[] }>(
          `/api/analytics/fixtures?plant=${encodeURIComponent(selectedPlant)}`,
          { signal: controller.signal },
        );
        if (
          controller.signal.aborted ||
          requestId !== fixturesRequestSeq.current
        )
          return;

        const list = Array.isArray(j.fixtures) ? j.fixtures : [];
        setFixtures(list);

        setFixtureSearch("");
        setFixtureSearchDebounced("");
        setSelectedFixtureKey(
          list.length ? `${list[0].adapter_code}||${list[0].fixture_type}` : "",
        );

        setForecast(null);
        setSeries([]);
        setEvents([]);
        setDaily([]);
        setDemandWeek([]);
        setDemandMonth([]);
        setProbeDemandSummary(null);
        setSelectedFixtureProbeInfo(null);
        setLastLoadedAt("");
        setEventFilter("ALL");
      } catch (e: any) {
        if (
          controller.signal.aborted ||
          requestId !== fixturesRequestSeq.current
        )
          return;
        setFixtures([]);
        setSelectedFixtureKey("");
        setForecast(null);
        setSeries([]);
        setEvents([]);
        setDaily([]);
        setDemandWeek([]);
        setDemandMonth([]);
        setProbeDemandSummary(null);
        setSelectedFixtureProbeInfo(null);
        setLastLoadedAt("");
        setEventFilter("ALL");
        setErr(String(e?.message || e));
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlant]);

  const filteredFixtures = useMemo(() => {
    const q = fixtureSearchDebounced.toLowerCase();

    // filter
    const list = !q
      ? fixtures
      : fixtures.filter((x) => {
          const hay =
            `${x.project_name ?? ""} ${x.adapter_code ?? ""} ${x.fixture_type ?? ""}`.toLowerCase();
          return hay.includes(q);
        });

    const norm = (v: any) =>
      String(v ?? "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width
        .replace(/\u00A0/g, " ") // nbsp -> space
        .trim()
        .toLowerCase()
        .normalize("NFKD");

    return [...list].sort((a, b) => {
      const pa = norm(a.project_name);
      const pb = norm(b.project_name);
      const c1 = pa.localeCompare(pb);
      if (c1 !== 0) return c1;

      const aa = norm(a.adapter_code);
      const ab = norm(b.adapter_code);
      const c2 = aa.localeCompare(ab);
      if (c2 !== 0) return c2;

      const fa = norm(a.fixture_type);
      const fb = norm(b.fixture_type);
      return fa.localeCompare(fb);
    });
  }, [fixtures, fixtureSearchDebounced]);

  // Keep selection valid
  useEffect(() => {
    if (!filteredFixtures.length) return;
    const exists = filteredFixtures.some(
      (x) => `${x.adapter_code}||${x.fixture_type}` === selectedFixtureKey,
    );
    if (!selectedFixtureKey || !exists) {
      const first = filteredFixtures[0];
      setSelectedFixtureKey(`${first.adapter_code}||${first.fixture_type}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFixtures]);

  const selectedFixture = useMemo(() => {
    const [a, f] = selectedFixtureKey.split("||");
    return (
      filteredFixtures.find(
        (x) => x.adapter_code === a && x.fixture_type === f,
      ) || null
    );
  }, [filteredFixtures, selectedFixtureKey]);

  async function loadAnalytics(signal?: AbortSignal) {
    if (!selectedPlant || !selectedFixture) return;
    const requestId = ++analyticsRequestSeq.current;

    setLoading(true);
    setErr(null);

    try {
      const base =
        `plant=${encodeURIComponent(selectedPlant)}` +
        `&adapter=${encodeURIComponent(selectedFixture.adapter_code)}` +
        `&fixture=${encodeURIComponent(selectedFixture.fixture_type)}`;

      const [jf, js, je, jd, jdem] = await Promise.all([
        fetchJson<{ forecast: ForecastRow | null }>(
          `/api/analytics/forecast?${base}&lookback=${encodeURIComponent(String(lookbackHours))}`,
          { signal },
        ),
        fetchJson<{ series: SeriesPoint[] }>(
          `/api/analytics/series?${base}&hours=${encodeURIComponent(String(seriesHours))}`,
          { signal },
        ),
        fetchJson<{ events: EventRow[] }>(
          `/api/analytics/events?${base}&limit=80`,
          { signal },
        ),
        fetchJson<{ daily: DailyRow[] }>(
          `/api/analytics/plant-daily?plant=${encodeURIComponent(selectedPlant)}&days=14`,
          { signal },
        ),
        fetchJson<{
          currentMonthUsage?: ProbeDemandUsageSummary;
          selectedFixture?: SelectedFixtureProbeDetail;
          period?: {
            summary?: ProbePeriodSummary;
            monthlyTrend?: ProbeMonthlyTrendRow[];
            demandByPn?: DemandAggRow[];
            fixtures?: ProbeFixtureDemandRow[];
          };
          week: { demandByPn: DemandAggRow[] };
          month: { demandByPn: DemandAggRow[] };
        }>(
          `/api/analytics/probe-demand?plant=${encodeURIComponent(selectedPlant)}&adapter=${encodeURIComponent(
            selectedFixture.adapter_code,
          )}&fixture=${encodeURIComponent(selectedFixture.fixture_type)}&lookback=${encodeURIComponent(
            String(lookbackHours),
          )}&start=${encodeURIComponent(probeStartDate)}&end=${encodeURIComponent(probeEndDate)}&partNumber=${encodeURIComponent(
            probePartSearch,
          )}`,
          { signal },
        ),
      ]);
      if (signal?.aborted || requestId !== analyticsRequestSeq.current) return;

      setForecast(jf.forecast ?? null);
      setSeries(Array.isArray(js.series) ? js.series : []);
      setEvents(Array.isArray(je.events) ? je.events : []);
      setDaily(Array.isArray(jd.daily) ? jd.daily : []);
      setDemandWeek(
        Array.isArray(jdem.week?.demandByPn) ? jdem.week.demandByPn : [],
      );
      setDemandMonth(
        Array.isArray(jdem.month?.demandByPn) ? jdem.month.demandByPn : [],
      );
      setProbeDemandSummary(jdem.currentMonthUsage ?? null);
      setSelectedFixtureProbeInfo(jdem.selectedFixture ?? null);
      setProbePeriodSummary(jdem.period?.summary ?? null);
      setProbePeriodDemand(
        Array.isArray(jdem.period?.demandByPn) ? jdem.period!.demandByPn! : [],
      );
      setProbeMonthlyTrend(
        Array.isArray(jdem.period?.monthlyTrend)
          ? jdem.period!.monthlyTrend!
          : [],
      );
      setProbeFixtureDemand(
        Array.isArray(jdem.period?.fixtures) ? jdem.period!.fixtures! : [],
      );
      setLastLoadedAt(new Date().toLocaleString());

      // keep filter valid after refresh
      setEventFilter("ALL");
    } catch (e: any) {
      if (signal?.aborted || requestId !== analyticsRequestSeq.current) return;
      setErr(String(e?.message || e));
      setForecast(null);
      setSeries([]);
      setEvents([]);
      setDaily([]);
      setDemandWeek([]);
      setDemandMonth([]);
      setProbeDemandSummary(null);
      setSelectedFixtureProbeInfo(null);
      setProbePeriodSummary(null);
      setProbePeriodDemand([]);
      setProbeMonthlyTrend([]);
      setProbeFixtureDemand([]);
      setLastLoadedAt("");
      setEventFilter("ALL");
    } finally {
      if (!signal?.aborted && requestId === analyticsRequestSeq.current) {
        setLoading(false);
      }
    }
  }

  // auto-load
  useEffect(() => {
    if (!selectedFixture) return;
    const controller = new AbortController();
    loadAnalytics(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPlant,
    selectedFixtureKey,
    lookbackHours,
    seriesHours,
    probeStartDate,
    probeEndDate,
    probePartSearch,
  ]);

  const warningLine =
    forecast?.warning_at ?? selectedFixture?.warning_at ?? null;
  const limitLine =
    forecast?.contacts_limit ?? selectedFixture?.contacts_limit ?? null;
  const currentContacts =
    forecast?.current_contacts ?? selectedFixture?.contacts ?? 0;

  // --- Forecast confidence (E3 guardrail) computed from series density in lookback window ---
  const forecastConfidence = useMemo(() => {
    // Count how many distinct hourly buckets exist within last lookbackHours
    const now = new Date();
    const cutoff = new Date(
      now.getTime() - Math.max(1, lookbackHours) * 3600 * 1000,
    );

    const buckets = (Array.isArray(series) ? series : [])
      .map((p) => parseChartTsToDate(p.sample_ts))
      .filter((d): d is Date => !!d && d >= cutoff && d <= now)
      .map(
        (d) =>
          `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`,
      );

    const uniq = new Set(buckets);
    const n = uniq.size;

    if (n >= 12) return { label: "Good", detail: `${n}h with data` };
    if (n >= 6) return { label: "OK", detail: `${n}h with data` };
    if (n >= 3) return { label: "Low", detail: `${n}h with data` };
    return { label: "Insufficient", detail: `${n}h with data` };
  }, [series, lookbackHours]);

  // --- Events coloring + legend counts + filtering ---
  const eventAgg = useMemo(() => {
    const counts: Record<ActionKey, number> = {
      LIMIT_CHANGE: 0,
      OWNER_CHANGE: 0,
      CONTACTS_UPDATED: 0,
      COUNTER_RESET: 0,
      TP_CHANGE: 0,
      OTHER: 0,
    };
    for (const e of events) counts[classifyEventType(e.event_type)]++;
    return counts;
  }, [events]);

  const eventsFiltered = useMemo(() => {
    if (eventFilter === "ALL") return events;
    return events.filter(
      (e) => classifyEventType(e.event_type) === eventFilter,
    );
  }, [events, eventFilter]);

  const sortedEvents = useMemo(() => {
    const dir = eventSortDir === "asc" ? 1 : -1;
    const arr = [...eventsFiltered];

    arr.sort((a, b) => {
      const av = (a as any)[eventSortKey];
      const bv = (b as any)[eventSortKey];

      if (eventSortKey === "created_at") {
        const ad = new Date(String(av ?? "")).getTime() || 0;
        const bd = new Date(String(bv ?? "")).getTime() || 0;
        return (ad - bd) * dir;
      }

      if (eventSortKey === "old_value" || eventSortKey === "new_value") {
        const an = Number(av);
        const bn = Number(bv);
        if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * dir;
      }

      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });

    return arr;
  }, [eventsFiltered, eventSortKey, eventSortDir]);

  function toggleSort(k: SortKey) {
    if (eventSortKey !== k) {
      setEventSortKey(k);
      setEventSortDir("asc");
      return;
    }
    setEventSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  // --- Chart data enhancements (delta + forecast lines) ---
  type ChartRow = SeriesPoint & {
    delta_h?: number | null;
    forecast_warn?: number | null;
    forecast_limit?: number | null;
  };

  // ✅ UPDATED: also returns ETA timestamps so we can draw vertical lines + labels
  const { chartData, etaWarnTs, etaLimitTs } = useMemo(() => {
    const base: ChartRow[] = (Array.isArray(series) ? series : []).map(
      (p, idx, arr) => {
        const prev = idx > 0 ? arr[idx - 1] : null;
        const delta = prev
          ? Number(p.contacts ?? 0) - Number(prev.contacts ?? 0)
          : null;
        return {
          ...p,
          delta_h: delta != null && Number.isFinite(delta) ? delta : null,
          forecast_warn: null,
          forecast_limit: null,
        };
      },
    );

    if (!base.length) {
      return {
        chartData: base,
        etaWarnTs: null as string | null,
        etaLimitTs: null as string | null,
      };
    }

    const last = base[base.length - 1];
    const lastD = parseChartTsToDate(last.sample_ts);
    if (!lastD) {
      return {
        chartData: base,
        etaWarnTs: null as string | null,
        etaLimitTs: null as string | null,
      };
    }

    const lastContacts = Number(last.contacts ?? 0);

    const etaW = forecast?.eta_warning_hours;
    const etaL = forecast?.eta_limit_hours;

    const makeTs = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
    };

    const out = [...base];

    let etaWarnTs: string | null = null;
    let etaLimitTs: string | null = null;

    // Warning forecast point + timestamp
    if (
      etaW != null &&
      Number.isFinite(etaW) &&
      etaW > 0 &&
      warningLine != null
    ) {
      out[out.length - 1] = {
        ...out[out.length - 1],
        forecast_warn: lastContacts,
      };

      const dt = new Date(lastD.getTime() + etaW * 3600 * 1000);
      etaWarnTs = makeTs(dt);

      out.push({
        ...last,
        sample_ts: etaWarnTs,
        contacts: Number(warningLine),
        delta_h: null,
        forecast_warn: Number(warningLine),
        forecast_limit: null,
      });
    }

    // Limit forecast point + timestamp
    if (
      etaL != null &&
      Number.isFinite(etaL) &&
      etaL > 0 &&
      limitLine != null
    ) {
      out[out.length - 1] = {
        ...out[out.length - 1],
        forecast_limit: lastContacts,
      };

      const dt = new Date(lastD.getTime() + etaL * 3600 * 1000);
      etaLimitTs = makeTs(dt);

      out.push({
        ...last,
        sample_ts: etaLimitTs,
        contacts: Number(limitLine),
        delta_h: null,
        forecast_warn: null,
        forecast_limit: Number(limitLine),
      });
    }

    out.sort((a, b) => {
      const ad = parseChartTsToDate(a.sample_ts)?.getTime() ?? 0;
      const bd = parseChartTsToDate(b.sample_ts)?.getTime() ?? 0;
      return ad - bd;
    });

    return { chartData: out, etaWarnTs, etaLimitTs };
  }, [series, forecast, warningLine, limitLine]);

  // --- TELMS intelligence helpers ---
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const fmtNumber = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return "—";
    return Math.round(value).toLocaleString("en-US");
  };

  const fmtPercent = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return "—";
    return `${Math.round(value)}%`;
  };

  const daysFromHours = (hours: number | null | undefined) => {
    if (hours == null || !Number.isFinite(hours)) return null;
    return hours / 24;
  };

  const etaScore = (etaHours: number | null | undefined) => {
    const days = daysFromHours(etaHours);
    if (days == null) return 70;
    if (days <= 0) return 0;
    if (days < 3) return 10;
    if (days < 7) return 30;
    if (days < 14) return 55;
    if (days < 30) return 75;
    return 100;
  };

  const health = useMemo(() => {
    const limit = Number(limitLine ?? 0);
    const warning = Number(warningLine ?? 0);
    const current = Number(currentContacts ?? 0);
    const resets = Number(selectedFixture?.resets ?? 0);

    const usagePercent =
      limit > 0 ? clamp((current / limit) * 100, 0, 130) : null;
    const warningPercent =
      warning > 0 ? clamp((current / warning) * 100, 0, 130) : null;
    const remainingCycles = limit > 0 ? Math.max(0, limit - current) : null;
    const remainingPercent =
      limit > 0 ? clamp(((limit - current) / limit) * 100, 0, 100) : null;
    const etaLimitDays = daysFromHours(forecast?.eta_limit_hours);
    const etaWarningDays = daysFromHours(forecast?.eta_warning_hours);

    const usageScore =
      usagePercent == null ? 70 : clamp(100 - usagePercent, 0, 100);
    const forecastScore = etaScore(forecast?.eta_limit_hours);
    const resetPenalty = clamp(resets * 2, 0, 20);
    const score = Math.round(
      clamp(0.6 * usageScore + 0.4 * forecastScore - resetPenalty, 0, 100),
    );

    let status: "Healthy" | "Watch" | "Attention" | "Critical" = "Healthy";
    let statusIcon = "🟢";
    let action = "No immediate action required.";

    if (limit > 0 && current >= limit) {
      status = "Critical";
      statusIcon = "🔴";
      action = "Maintenance is due now. Plan counter reset after service.";
    } else if ((etaLimitDays != null && etaLimitDays < 7) || score < 45) {
      status = "Critical";
      statusIcon = "🔴";
      action = "Schedule maintenance as soon as possible.";
    } else if (
      (etaLimitDays != null && etaLimitDays < 14) ||
      (usagePercent != null && usagePercent >= 90) ||
      score < 65
    ) {
      status = "Attention";
      statusIcon = "🟠";
      action = "Prepare maintenance and required test probes.";
    } else if (
      (etaLimitDays != null && etaLimitDays < 30) ||
      (warning > 0 && current >= warning) ||
      score < 80
    ) {
      status = "Watch";
      statusIcon = "🟡";
      action = "Monitor trend and include in maintenance planning.";
    }

    return {
      score,
      status,
      statusIcon,
      action,
      usagePercent,
      warningPercent,
      remainingCycles,
      remainingPercent,
      etaLimitDays,
      etaWarningDays,
      resetPenalty,
    };
  }, [
    currentContacts,
    forecast?.eta_limit_hours,
    forecast?.eta_warning_hours,
    limitLine,
    selectedFixture?.resets,
    warningLine,
  ]);

  const plannerRows = useMemo(() => {
    const rows = fixtures.map((fixture) => {
      const current = Number(fixture.contacts ?? 0);
      const limit = Number(fixture.contacts_limit ?? 0);
      const warning = Number(fixture.warning_at ?? 0);
      const remainingCycles = limit > 0 ? Math.max(0, limit - current) : null;
      const usagePercent =
        limit > 0 ? clamp((current / limit) * 100, 0, 130) : null;

      let bucket: "Due now" | "Warning" | "Plan soon" | "Normal" = "Normal";
      let priority = 4;
      if (limit > 0 && current >= limit) {
        bucket = "Due now";
        priority = 1;
      } else if (warning > 0 && current >= warning) {
        bucket = "Warning";
        priority = 2;
      } else if (usagePercent != null && usagePercent >= 80) {
        bucket = "Plan soon";
        priority = 3;
      }

      return { ...fixture, remainingCycles, usagePercent, bucket, priority };
    });

    return rows.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const ar = a.remainingCycles ?? Number.MAX_SAFE_INTEGER;
      const br = b.remainingCycles ?? Number.MAX_SAFE_INTEGER;
      return ar - br;
    });
  }, [fixtures]);

  const plannerSummary = useMemo(() => {
    return {
      dueNow: plannerRows.filter((x) => x.bucket === "Due now").length,
      warning: plannerRows.filter((x) => x.bucket === "Warning").length,
      planSoon: plannerRows.filter((x) => x.bucket === "Plan soon").length,
    };
  }, [plannerRows]);

  // UI helpers
  const Hint = ({ text }: { text: string }) => (
    <span
      title={text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        marginLeft: 6,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: "rgba(255,255,255,0.16)",
        color: "#fff",
        cursor: "help",
        userSelect: "none",
      }}
    >
      ?
    </span>
  );

  const filterGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
    alignItems: "end",
    marginBottom: 14,
  };

  const fieldStyle: React.CSSProperties = {
    padding: "8px 10px",
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.85,
    color: "#fff",
    display: "flex",
    alignItems: "center",
  };

  const chartHeight = 340; // stable height

  const canRenderChart =
    mounted &&
    tab === "trends" &&
    chartBox.width > 10 &&
    chartHeight > 10 &&
    chartData.length > 0;

  return (
    <div className="mx-4 my-4" style={{ minWidth: 0 }}>
      <h2 style={{ marginBottom: 12, color: "#fff" }}>Analytics</h2>

      {/* Tabs */}
      <div
        style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}
      >
        {[
          { key: "overview", label: "TELMS overview" },
          { key: "planner", label: "Maintenance planner" },
          { key: "trends", label: "Trends & forecast" },
          { key: "probe", label: "Probe demand" },
          { key: "events", label: "Event history" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key as TabKey)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background:
                tab === item.key ? "rgba(255,255,255,0.16)" : "transparent",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={filterGridStyle}>
        <div>
          <div style={labelStyle}>
            Plant{" "}
            <Hint text="Select plant. Engineers usually see only their plant. Admin can switch." />
          </div>
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            style={fieldStyle}
          >
            {plants.length ? (
              plants.map((p) => (
                <option key={p.entry_id} value={p.plant_name}>
                  {p.plant_name}
                </option>
              ))
            ) : (
              <option value="Timisoara">Timisoara</option>
            )}
          </select>
        </div>

        <div>
          <div style={labelStyle}>
            Fixture search{" "}
            <Hint text="Type project / adapter / type. Press Esc to clear. Press / to focus from anywhere." />
          </div>
          <input
            ref={fixtureSearchRef}
            value={fixtureSearch}
            onChange={(e) => setFixtureSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setFixtureSearch("");
                setFixtureSearchDebounced("");
              }
            }}
            placeholder="Search project / adapter / fixture type…"
            style={fieldStyle}
          />
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <div style={labelStyle}>
            Fixture{" "}
            <Hint text="Dropdown is filtered by the search box. It won't move around while typing." />
          </div>
          <select
            value={selectedFixtureKey}
            onChange={(e) => setSelectedFixtureKey(e.target.value)}
            style={fieldStyle}
          >
            {filteredFixtures.length ? (
              filteredFixtures.map((x) => (
                <option
                  key={x.entry_id}
                  value={`${x.adapter_code}||${x.fixture_type}`}
                >
                  {x.project_name} — {x.adapter_code} / {x.fixture_type}
                </option>
              ))
            ) : (
              <option value="">No fixtures match search</option>
            )}
          </select>
        </div>

        <div>
          <div style={labelStyle}>
            Forecast lookback{" "}
            <Hint text="Hours used for burn-rate calculation. Longer = smoother but slower to react." />
          </div>
          <select
            value={lookbackHours}
            onChange={(e) => setLookbackHours(Number(e.target.value))}
            style={fieldStyle}
          >
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={72}>72 hours</option>
            <option value={168}>7 days</option>
            <option value={336}>14 days</option>
            <option value={720}>30 days</option>
          </select>
        </div>

        <div>
          <div style={labelStyle}>
            Series range{" "}
            <Hint text="Time window shown in the chart. You can go up to 365 days." />
          </div>
          <select
            value={seriesHours}
            onChange={(e) => setSeriesHours(Number(e.target.value))}
            style={fieldStyle}
          >
            <option value={24}>24 hours</option>
            <option value={72}>72 hours</option>
            <option value={168}>7 days</option>
            <option value={336}>14 days</option>
            <option value={720}>30 days</option>
            <option value={1440}>60 days</option>
            <option value={2160}>90 days</option>
            <option value={8760}>365 days</option>
          </select>
        </div>

        <div>
          <button
            onClick={() => loadAnalytics()}
            disabled={loading || !selectedFixture}
            title="Fetch newest analytics for current selection"
            style={{
              padding: "9px 14px",
              width: "100%",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.16)",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>

          {/* {lastLoadedAt ? (
            <div className="label" style={{ marginTop: 6, color: "#fff", opacity: 0.85 }}>
              Last refresh: {lastLoadedAt}
            </div>
          ) : null} */}
        </div>
      </div>

      <div style={labelStyle}>
        <div
          className="label"
          style={{ marginTop: 6, color: "#fff", opacity: 0.85 }}
        >
          {selectedFixture ? (
            <>
              Selected: {selectedFixture.project_name} —{" "}
              {selectedFixture.adapter_code} / {selectedFixture.fixture_type}
            </>
          ) : (
            <>No fixture selected</>
          )}
        </div>
      </div>

      {err && (
        <div
          className="analytics-card"
          style={{ padding: 10, borderRadius: 12, marginBottom: 12 }}
        >
          <div className="label" style={{ marginBottom: 6 }}>
            Error
          </div>
          <div className="value" style={{ fontSize: 14, fontWeight: 600 }}>
            {err}
          </div>
        </div>
      )}

      {/* TAB: PROBE DEMAND */}
      {tab === "probe" ? (
        <>
          <div
            className="analytics-card p-3 rounded text-white"
            style={{ marginBottom: 12 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  Plant probe demand overview
                </div>
                <div className="label" style={{ opacity: 0.9, marginTop: 4 }}>
                  Estimated probe consumption based on counter reset events in
                  the selected period and the current probe BOM.
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>
                    From
                  </div>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={probeStartDate}
                    onChange={(e) => setProbeStartDate(e.target.value)}
                    style={{ minWidth: 150 }}
                  />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>
                    To
                  </div>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={probeEndDate}
                    onChange={(e) => setProbeEndDate(e.target.value)}
                    style={{ minWidth: 150 }}
                  />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>
                    Part number
                  </div>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Search probe PN..."
                    value={probePartSearch}
                    onChange={(e) => setProbePartSearch(e.target.value)}
                    style={{ minWidth: 220 }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Estimated used probes</div>
              <div className="value" style={{ fontSize: 30 }}>
                {fmtNumber(probePeriodSummary?.total_qty)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                {probeStartDate} → {probeEndDate}
              </div>
            </div>
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Resets in period</div>
              <div className="value" style={{ fontSize: 30 }}>
                {fmtNumber(probePeriodSummary?.resets)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                Maintenance/reset events
              </div>
            </div>
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Fixtures involved</div>
              <div className="value" style={{ fontSize: 30 }}>
                {fmtNumber(probePeriodSummary?.fixtures)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                With probe demand
              </div>
            </div>
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Unique part numbers</div>
              <div className="value" style={{ fontSize: 30 }}>
                {fmtNumber(probePeriodSummary?.part_numbers)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                {probePartSearch ? "Filtered" : "Plant overview"}
              </div>
            </div>
          </div>

          <div
            className="analytics-card p-3 rounded text-white"
            style={{ marginBottom: 12 }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              Monthly probe demand trend
            </div>
            <div className="label" style={{ opacity: 0.9, marginBottom: 10 }}>
              Monthly estimated quantities for the whole selected plant. This is
              intended for stock planning and demand visibility.
            </div>
            <div
              ref={probeChartBox.ref}
              style={{ height: 320, minWidth: 0, overflowX: "auto" }}
            >
              {mounted && probeMonthlyTrend.length ? (
                <ComposedChart
                  width={Math.max(720, probeChartBox.width || 720)}
                  height={300}
                  data={probeMonthlyTrend}
                  margin={{ top: 10, right: 20, bottom: 12, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_qty" name="Estimated probes used" />
                  <Line
                    type="monotone"
                    dataKey="resets"
                    name="Resets"
                    dot={false}
                  />
                </ComposedChart>
              ) : (
                <div className="label">
                  No probe demand trend available for this period.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: 12,
            }}
          >
            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Demand by part number
              </div>
              <div className="label" style={{ opacity: 0.9, marginBottom: 10 }}>
                Aggregated estimated usage for the selected date range.
              </div>
              <div style={{ overflowX: "auto", maxHeight: 460 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Part number
                      </th>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Estimated qty
                      </th>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Fixtures
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {probePeriodDemand.length ? (
                      probePeriodDemand.slice(0, 100).map((r) => (
                        <tr
                          key={`period-${r.part_number}`}
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.10)",
                          }}
                        >
                          <td style={{ padding: "8px 6px" }}>
                            {r.part_number}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {fmtNumber(r.total_qty)}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {fmtNumber(r.fixtures)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          className="label"
                          style={{ padding: 8 }}
                          colSpan={3}
                        >
                          No probe demand found for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Demand by fixture
              </div>
              <div className="label" style={{ opacity: 0.9, marginBottom: 10 }}>
                Highlights which fixtures generated the highest estimated probe
                demand.
              </div>
              <div style={{ overflowX: "auto", maxHeight: 460 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Fixture
                      </th>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Resets
                      </th>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Probe BOM qty
                      </th>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Estimated used
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {probeFixtureDemand.length ? (
                      probeFixtureDemand.slice(0, 100).map((r) => (
                        <tr
                          key={`fx-${r.adapter_code}-${r.fixture_type}`}
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.10)",
                          }}
                        >
                          <td style={{ padding: "8px 6px" }}>
                            <div style={{ fontWeight: 700 }}>
                              {r.project_name || "—"}
                            </div>
                            <div className="label">
                              {r.adapter_code} / {r.fixture_type}
                            </div>
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {fmtNumber(r.resets)}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {fmtNumber(r.total_requested_qty)}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {fmtNumber(r.estimated_used_qty)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          className="label"
                          style={{ padding: 8 }}
                          colSpan={4}
                        >
                          No fixture-level demand found for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div
            className="analytics-card p-3 rounded text-white"
            style={{ marginTop: 12 }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              Forward-looking stock risk
            </div>
            <div className="label" style={{ opacity: 0.9, marginBottom: 10 }}>
              Existing forecast-based demand, kept as planning support for
              upcoming maintenance windows.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Next 7 days
                </div>
                <div className="label" style={{ marginBottom: 6 }}>
                  {demandSummary.week.partNumbers} part numbers ·{" "}
                  {fmtNumber(demandSummary.week.totalQty)} units
                </div>
                {demandWeek.slice(0, 8).map((r) => (
                  <div
                    key={`w-${r.part_number}`}
                    className="label"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      padding: "5px 0",
                    }}
                  >
                    <span>{r.part_number}</span>
                    <strong>{fmtNumber(r.total_qty)}</strong>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Next 30 days
                </div>
                <div className="label" style={{ marginBottom: 6 }}>
                  {demandSummary.month.partNumbers} part numbers ·{" "}
                  {fmtNumber(demandSummary.month.totalQty)} units
                </div>
                {demandMonth.slice(0, 8).map((r) => (
                  <div
                    key={`m-${r.part_number}`}
                    className="label"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      padding: "5px 0",
                    }}
                  >
                    <span>{r.part_number}</span>
                    <strong>{fmtNumber(r.total_qty)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* TAB: OVERVIEW */}
      {tab === "overview" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Equipment health</div>
              <div
                className="value"
                style={{
                  fontSize: 30,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>{health.statusIcon}</span>
                <span>{health.score}/100</span>
              </div>
              <div className="label" style={{ marginTop: 6, fontWeight: 800 }}>
                {health.status}
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Remaining useful life</div>
              <div className="value" style={{ fontSize: 30 }}>
                {fmtPercent(health.remainingPercent)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                {fmtNumber(health.remainingCycles)} cycles remaining
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label">ETA to limit</div>
              <div className="value" style={{ fontSize: 30 }}>
                {fmtHours(forecast?.eta_limit_hours)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                {health.etaLimitDays != null
                  ? `${health.etaLimitDays.toFixed(1)} days`
                  : "Forecast not available"}
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Recommended action</div>
              <div className="value" style={{ fontSize: 16, lineHeight: 1.35 }}>
                {health.action}
              </div>
              <div className="label" style={{ marginTop: 8 }}>
                Confidence: {forecastConfidence.label} ·{" "}
                {forecastConfidence.detail}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Usage snapshot
              </div>
              <div className="label" style={{ marginBottom: 6 }}>
                Current contacts
              </div>
              <div className="value" style={{ fontSize: 22 }}>
                {fmtNumber(currentContacts)}
              </div>
              <div className="label" style={{ marginTop: 8 }}>
                Usage: {fmtPercent(health.usagePercent)} · warning:{" "}
                {warningLine ?? "—"} · limit: {limitLine ?? "—"}
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Burn rate</div>
              <div className="value" style={{ fontSize: 22 }}>
                {fmtRate(forecast?.avg_contacts_per_hour)}
              </div>
              <div className="label" style={{ marginTop: 8 }}>
                Window:{" "}
                {forecast?.window_start ? safeStr(forecast.window_start) : "—"}{" "}
                → {forecast?.window_end ? safeStr(forecast.window_end) : "—"}
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Next thresholds
              </div>
              <div className="label" style={{ marginBottom: 6 }}>
                ETA to warning: {fmtHours(forecast?.eta_warning_hours)}
              </div>
              <div className="label">
                ETA to limit: {fmtHours(forecast?.eta_limit_hours)}
              </div>
              <div className="label" style={{ marginTop: 8 }}>
                Reset penalty in health score: {health.resetPenalty} points
              </div>
            </div>
          </div>

          <div
            className="analytics-card p-3 rounded text-white"
            style={{ marginBottom: 14 }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              TELMS summary
            </div>
            <div className="label" style={{ lineHeight: 1.6 }}>
              This view shows only the decision-critical information. Use
              Maintenance Planner for plant-level priorities, Trends & Forecast
              for the detailed chart, Probe Demand for consumables, and Event
              History for audit details.
            </div>
          </div>
        </>
      ) : null}

      {/* TAB: MAINTENANCE PLANNER */}
      {tab === "planner" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Due now</div>
              <div className="value" style={{ fontSize: 28 }}>
                🔴 {plannerSummary.dueNow}
              </div>
            </div>
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">At warning threshold</div>
              <div className="value" style={{ fontSize: 28 }}>
                🟠 {plannerSummary.warning}
              </div>
            </div>
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Plan soon</div>
              <div className="value" style={{ fontSize: 28 }}>
                🟡 {plannerSummary.planSoon}
              </div>
            </div>
          </div>

          <div
            className="analytics-card p-3 rounded text-white"
            style={{ marginBottom: 14 }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              Plant maintenance priority list
            </div>
            <div className="label" style={{ marginBottom: 10 }}>
              Prioritized by current counter status. Forecast-based plant
              planner can be added later after exposing forecast for all
              fixtures.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th className="label" style={{ padding: "8px 6px" }}>
                      Status
                    </th>
                    <th className="label" style={{ padding: "8px 6px" }}>
                      Project
                    </th>
                    <th className="label" style={{ padding: "8px 6px" }}>
                      Adapter
                    </th>
                    <th className="label" style={{ padding: "8px 6px" }}>
                      Fixture
                    </th>
                    <th className="label" style={{ padding: "8px 6px" }}>
                      Usage
                    </th>
                    <th className="label" style={{ padding: "8px 6px" }}>
                      Remaining cycles
                    </th>
                    <th className="label" style={{ padding: "8px 6px" }}>
                      Last update
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plannerRows.length ? (
                    plannerRows.slice(0, 50).map((row) => (
                      <tr
                        key={`planner-${row.entry_id}`}
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.10)",
                        }}
                      >
                        <td
                          style={{ padding: "8px 6px", whiteSpace: "nowrap" }}
                        >
                          {row.bucket === "Due now"
                            ? "🔴"
                            : row.bucket === "Warning"
                              ? "🟠"
                              : row.bucket === "Plan soon"
                                ? "🟡"
                                : "🟢"}{" "}
                          {row.bucket}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {row.project_name}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {row.adapter_code}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {row.fixture_type}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {fmtPercent(row.usagePercent)}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {fmtNumber(row.remainingCycles)}
                        </td>
                        <td
                          style={{ padding: "8px 6px", whiteSpace: "nowrap" }}
                        >
                          {fmtDateTime(row.last_update)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="label" style={{ padding: 8 }} colSpan={7}>
                        No fixtures found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* TAB: TRENDS */}
      {tab === "trends" ? (
        <>
          {/* Chart options */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Chart options
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showDeltaLine}
                  onChange={(e) => setShowDeltaLine(e.target.checked)}
                />
                <span>
                  Show <b>Δ/h</b> line (recommended when contacts are high and
                  look flat)
                </span>
              </label>
              <div className="label" style={{ marginTop: 10, opacity: 0.9 }}>
                Forecast lines are drawn using burn rate and ETA. Dashed
                reference lines show warning/limit thresholds.
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Plant daily overview (last 14 days)
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Day
                      </th>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        Resets
                      </th>
                      <th className="label" style={{ padding: "8px 6px" }}>
                        TP events
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.length ? (
                      daily.map((d) => (
                        <tr
                          key={d.day}
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.10)",
                          }}
                        >
                          <td
                            style={{ padding: "8px 6px", whiteSpace: "nowrap" }}
                          >
                            {d.day}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {Number(d.resets ?? 0)}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {Number(d.tp_events ?? 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          className="label"
                          style={{ padding: 8 }}
                          colSpan={3}
                        >
                          No daily data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div
            className="analytics-card p-3 rounded text-white"
            style={{ marginBottom: 14 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 800 }}>
                Contacts (hourly) + Forecast
              </div>
              <div className="label" style={{ opacity: 0.9 }}>
                {showDeltaLine
                  ? "Δ/h helps visualize activity"
                  : "Tip: enable Δ/h when line looks flat"}
              </div>
            </div>

            {/* Measured chart box */}
            <div
              ref={chartBox.ref}
              style={{
                width: "100%",
                height: chartHeight,
                minWidth: 0,
              }}
            >
              {canRenderChart ? (
                <LineChart
                  width={chartBox.width}
                  height={chartHeight}
                  data={chartData}
                >
                  {/* ✅ COLORS + ETA MARKERS ONLY */}
                  <CartesianGrid stroke="rgba(255,255,255,0.10)" />

                  <XAxis
                    dataKey="sample_ts"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.85)" }}
                    minTickGap={22}
                  />

                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.85)" }}
                    domain={["auto", "auto"]}
                  />

                  {showDeltaLine ? (
                    <YAxis
                      yAxisId="delta"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "rgba(255,255,255,0.85)" }}
                      domain={["auto", "auto"]}
                    />
                  ) : null}

                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,30,0.92)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.90)" }}
                    itemStyle={{ color: "rgba(255,255,255,0.90)" }}
                  />

                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.9)" }} />

                  {/* Threshold lines with colors */}
                  {typeof warningLine === "number" && warningLine > 0 ? (
                    <ReferenceLine
                      y={warningLine}
                      stroke="#f0ad4e"
                      strokeDasharray="6 4"
                      label={{
                        value: "Warning",
                        position: "insideTopRight",
                        fill: "#f0ad4e",
                        fontSize: 12,
                      }}
                    />
                  ) : null}

                  {typeof limitLine === "number" && limitLine > 0 ? (
                    <ReferenceLine
                      y={limitLine}
                      stroke="#d9534f"
                      strokeDasharray="6 4"
                      label={{
                        value: "Limit",
                        position: "insideTopRight",
                        fill: "#d9534f",
                        fontSize: 12,
                      }}
                    />
                  ) : null}

                  {/* ETA vertical markers (estimated dates) */}
                  {etaWarnTs ? (
                    <ReferenceLine
                      x={etaWarnTs}
                      stroke="#f0ad4e"
                      strokeDasharray="3 6"
                      strokeWidth={2}
                      label={{
                        value: `Warning ETA\n${fmtDateTime(etaWarnTs)}`,
                        position: "top",
                        fill: "#f0ad4e",
                        fontSize: 12,
                        fontWeight: "bold",
                        textAnchor: "middle",
                      }}
                    />
                  ) : null}

                  {etaLimitTs ? (
                    <ReferenceLine
                      x={etaLimitTs}
                      stroke="#d9534f"
                      strokeDasharray="3 6"
                      strokeWidth={2}
                      label={{
                        value: `Limit ETA\n${fmtDateTime(etaLimitTs)}`,
                        position: "top",
                        fill: "#d9534f",
                        fontSize: 12,
                        fontWeight: "bold",
                        textAnchor: "middle",
                      }}
                    />
                  ) : null}

                  {/* Lines with colors */}
                  <Line
                    type="monotone"
                    dataKey="contacts"
                    dot={false}
                    name="Contacts"
                    stroke="#5bc0de"
                    strokeWidth={2}
                  />

                  {showDeltaLine ? (
                    <Line
                      type="monotone"
                      dataKey="delta_h"
                      yAxisId="delta"
                      dot={false}
                      name="Δ/h"
                      connectNulls
                      stroke="#5cb85c"
                      strokeWidth={1.6}
                    />
                  ) : null}

                  <Line
                    type="monotone"
                    dataKey="forecast_warn"
                    dot={false}
                    name="Forecast → Warning"
                    connectNulls
                    stroke="#f0ad4e"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />

                  <Line
                    type="monotone"
                    dataKey="forecast_limit"
                    dot={false}
                    name="Forecast → Limit"
                    connectNulls
                    stroke="#d9534f"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                </LineChart>
              ) : (
                <div className="label" style={{ padding: "10px 0" }}>
                  {mounted
                    ? "No samples for the selected range (or chart is measuring…)"
                    : "Loading chart…"}
                </div>
              )}
            </div>

            <div className="label" style={{ marginTop: 8 }}>
              Dashed horizontal lines: warning / limit. Forecast lines use burn
              rate + ETA. Vertical markers show ETA timestamps.
            </div>
            {(etaWarnTs || etaLimitTs) && (
              <div
                className="label"
                style={{ marginTop: 8, fontWeight: "bold" }}
              >
                Forecasted dates:{" "}
                {etaWarnTs ? `Warning at ${fmtDateTime(etaWarnTs)}` : ""}
                {etaWarnTs && etaLimitTs ? " · " : ""}
                {etaLimitTs ? `Limit at ${fmtDateTime(etaLimitTs)}` : ""}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* TAB: EVENT HISTORY */}
      {tab === "events" ? (
        <>
          <div className="analytics-card p-3 rounded text-white">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 800 }}>Recent events</div>

              {/* Legend chips */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setEventFilter("ALL")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background:
                      eventFilter === "ALL"
                        ? "rgba(255,255,255,0.16)"
                        : "rgba(255,255,255,0.06)",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                  title="Show all events"
                >
                  All ({events.length})
                </button>

                {(Object.keys(ACTION_UI) as ActionKey[]).map((k) => {
                  const ui = ACTION_UI[k];
                  const c = eventAgg[k] ?? 0;
                  if (!c) return null;
                  const active = eventFilter === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setEventFilter(active ? "ALL" : k)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: `1px solid ${ui.border}`,
                        background: active ? ui.bg : "rgba(255,255,255,0.06)",
                        color: "#fff",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                      title={`Filter: ${ui.label}`}
                    >
                      {ui.label} ({c})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="label" style={{ marginBottom: 8 }}>
              Click headers to sort (current: {eventSortKey} {eventSortDir})
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th
                      className="label"
                      style={{ padding: "8px 6px", cursor: "pointer" }}
                      onClick={() => toggleSort("created_at")}
                    >
                      Date
                    </th>
                    <th className="label" style={{ padding: "8px 6px" }}>
                      Time
                    </th>
                    <th
                      className="label"
                      style={{ padding: "8px 6px", cursor: "pointer" }}
                      onClick={() => toggleSort("event_type")}
                    >
                      Type
                    </th>
                    <th
                      className="label"
                      style={{ padding: "8px 6px", cursor: "pointer" }}
                      onClick={() => toggleSort("event_details")}
                    >
                      Details
                    </th>
                    <th
                      className="label"
                      style={{ padding: "8px 6px", cursor: "pointer" }}
                      onClick={() => toggleSort("old_value")}
                    >
                      Old
                    </th>
                    <th
                      className="label"
                      style={{ padding: "8px 6px", cursor: "pointer" }}
                      onClick={() => toggleSort("new_value")}
                    >
                      New
                    </th>
                    <th
                      className="label"
                      style={{ padding: "8px 6px", cursor: "pointer" }}
                      onClick={() => toggleSort("actor")}
                    >
                      Actor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.length ? (
                    sortedEvents.map((e) => {
                      const dt = splitDateTime(e.created_at);
                      const k = classifyEventType(e.event_type);
                      const ui = ACTION_UI[k];

                      return (
                        <tr
                          key={e.entry_id}
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.10)",
                            background: ui.bg,
                          }}
                        >
                          <td
                            style={{ padding: "8px 6px", whiteSpace: "nowrap" }}
                          >
                            {dt.date}
                          </td>
                          <td
                            style={{ padding: "8px 6px", whiteSpace: "nowrap" }}
                          >
                            {dt.time}
                          </td>
                          <td
                            style={{ padding: "8px 6px", whiteSpace: "nowrap" }}
                          >
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                border: `1px solid ${ui.border}`,
                                background: "rgba(0,0,0,0.10)",
                                fontWeight: 800,
                                fontSize: 12,
                              }}
                              title={`Category: ${ui.label}`}
                            >
                              {e.event_type}
                            </span>
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {e.event_details ?? ""}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {e.old_value ?? ""}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {e.new_value ?? ""}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {e.actor ?? ""}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td style={{ padding: 8 }} className="label" colSpan={7}>
                        No events.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <div style={{ height: 20 }} />
    </div>
  );
}
