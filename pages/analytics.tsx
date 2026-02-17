import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

// ✅ Remove ResponsiveContainer (it causes width/height -1 warnings when parent is hidden/0px)
// We'll render LineChart with explicit width/height from a measured container.

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

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
type DemandAggRow = { part_number: string; total_qty: number; fixtures: number };

type SortKey = "created_at" | "event_type" | "actor" | "old_value" | "new_value" | "event_details";
type SortDir = "asc" | "desc";
type TabKey = "overview" | "probe";

function fmtHours(h: number | null | undefined) {
  if (h == null || !Number.isFinite(h)) return "—";
  if (h <= 0) return "0h";
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
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
async function fetchJson<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
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
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}

// --- Event coloring / legend ---
type ActionKey = "LIMIT_CHANGE" | "OWNER_CHANGE" | "CONTACTS_UPDATED" | "COUNTER_RESET" | "TP_CHANGE" | "OTHER";

function classifyEventType(raw: string): ActionKey {
  const t = String(raw ?? "").toUpperCase();

  if (t.includes("LIMIT") || t.includes("WARNING")) return "LIMIT_CHANGE";
  if (t.includes("OWNER")) return "OWNER_CHANGE";
  if (t.includes("CONTACT") || t.includes("INCREMENT") || t.includes("COUNTER_INC")) return "CONTACTS_UPDATED";
  if (t.includes("RESET")) return "COUNTER_RESET";
  if (t.includes("TP") || t.includes("PROBE")) return "TP_CHANGE";

  return "OTHER";
}

const ACTION_UI: Record<ActionKey, { label: string; bg: string; border: string }> = {
  LIMIT_CHANGE: { label: "Limit", bg: "rgba(255, 193, 7, 0.22)", border: "rgba(255,193,7,0.35)" },
  OWNER_CHANGE: { label: "Owner", bg: "rgba(13, 110, 253, 0.18)", border: "rgba(13,110,253,0.32)" },
  CONTACTS_UPDATED: { label: "Contacts", bg: "rgba(25, 135, 84, 0.18)", border: "rgba(25,135,84,0.32)" },
  COUNTER_RESET: { label: "Reset", bg: "rgba(220, 53, 69, 0.18)", border: "rgba(220,53,69,0.32)" },
  TP_CHANGE: { label: "Test Probes", bg: "rgba(111, 66, 193, 0.18)", border: "rgba(111,66,193,0.32)" },
  OTHER: { label: "Other", bg: "rgba(255,255,255,0.10)", border: "rgba(255,255,255,0.18)" },
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

  // Measured chart container (explicit LineChart width/height)
  const chartBox = useMeasuredSize<HTMLDivElement>();

  useEffect(() => setMounted(true), []);

  // Debounce fixture search
  useEffect(() => {
    const t = setTimeout(() => setFixtureSearchDebounced(fixtureSearch.trim()), 160);
    return () => clearTimeout(t);
  }, [fixtureSearch]);

  // "/" focuses search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingField =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

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

        if (list.length === 1 && list[0]?.plant_name) {
          setSelectedPlant(list[0].plant_name);
        }
      } catch (e: any) {
        console.error(e);
        setPlants([]);
      }
    })();
  }, []);

  // Load fixtures for plant
  useEffect(() => {
    if (!selectedPlant) return;
    setErr(null);

    (async () => {
      try {
        const j = await fetchJson<{ fixtures: Fixture[] }>(`/api/analytics/fixtures?plant=${encodeURIComponent(selectedPlant)}`);
        const list = Array.isArray(j.fixtures) ? j.fixtures : [];
        setFixtures(list);

        setFixtureSearch("");
        setFixtureSearchDebounced("");
        setSelectedFixtureKey(list.length ? `${list[0].adapter_code}||${list[0].fixture_type}` : "");

        setForecast(null);
        setSeries([]);
        setEvents([]);
        setDaily([]);
        setDemandWeek([]);
        setDemandMonth([]);
        setLastLoadedAt("");
        setEventFilter("ALL");
      } catch (e: any) {
        setFixtures([]);
        setSelectedFixtureKey("");
        setForecast(null);
        setSeries([]);
        setEvents([]);
        setDaily([]);
        setDemandWeek([]);
        setDemandMonth([]);
        setLastLoadedAt("");
        setEventFilter("ALL");
        setErr(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlant]);

  const filteredFixtures = useMemo(() => {
    const q = fixtureSearchDebounced.toLowerCase();
    if (!q) return fixtures;
    return fixtures.filter((x) => {
      const hay = `${x.project_name ?? ""} ${x.adapter_code ?? ""} ${x.fixture_type ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [fixtures, fixtureSearchDebounced]);

  // Keep selection valid
  useEffect(() => {
    if (!filteredFixtures.length) return;
    const exists = filteredFixtures.some((x) => `${x.adapter_code}||${x.fixture_type}` === selectedFixtureKey);
    if (!selectedFixtureKey || !exists) {
      const first = filteredFixtures[0];
      setSelectedFixtureKey(`${first.adapter_code}||${first.fixture_type}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFixtures]);

  const selectedFixture = useMemo(() => {
    const [a, f] = selectedFixtureKey.split("||");
    return filteredFixtures.find((x) => x.adapter_code === a && x.fixture_type === f) || null;
  }, [filteredFixtures, selectedFixtureKey]);

  async function loadAnalytics() {
    if (!selectedPlant || !selectedFixture) return;

    setLoading(true);
    setErr(null);

    try {
      const base =
        `plant=${encodeURIComponent(selectedPlant)}` +
        `&adapter=${encodeURIComponent(selectedFixture.adapter_code)}` +
        `&fixture=${encodeURIComponent(selectedFixture.fixture_type)}`;

      const [jf, js, je, jd, jdem] = await Promise.all([
        fetchJson<{ forecast: ForecastRow | null }>(`/api/analytics/forecast?${base}&lookback=${encodeURIComponent(String(lookbackHours))}`),
        fetchJson<{ series: SeriesPoint[] }>(`/api/analytics/series?${base}&hours=${encodeURIComponent(String(seriesHours))}`),
        fetchJson<{ events: EventRow[] }>(`/api/analytics/events?${base}&limit=80`),
        fetchJson<{ daily: DailyRow[] }>(`/api/analytics/plant-daily?plant=${encodeURIComponent(selectedPlant)}&days=14`),
        fetchJson<{ week: { demandByPn: DemandAggRow[] }; month: { demandByPn: DemandAggRow[] } }>(
          `/api/analytics/probe-demand?plant=${encodeURIComponent(selectedPlant)}&lookback=${encodeURIComponent(String(lookbackHours))}`
        ),
      ]);

      setForecast(jf.forecast ?? null);
      setSeries(Array.isArray(js.series) ? js.series : []);
      setEvents(Array.isArray(je.events) ? je.events : []);
      setDaily(Array.isArray(jd.daily) ? jd.daily : []);
      setDemandWeek(Array.isArray(jdem.week?.demandByPn) ? jdem.week.demandByPn : []);
      setDemandMonth(Array.isArray(jdem.month?.demandByPn) ? jdem.month.demandByPn : []);
      setLastLoadedAt(new Date().toLocaleString());

      // keep filter valid after refresh
      setEventFilter("ALL");
    } catch (e: any) {
      setErr(String(e?.message || e));
      setForecast(null);
      setSeries([]);
      setEvents([]);
      setDaily([]);
      setDemandWeek([]);
      setDemandMonth([]);
      setLastLoadedAt("");
      setEventFilter("ALL");
    } finally {
      setLoading(false);
    }
  }

  // auto-load
  useEffect(() => {
    if (selectedFixture) loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFixtureKey, lookbackHours, seriesHours]);

  const warningLine = forecast?.warning_at ?? selectedFixture?.warning_at ?? null;
  const limitLine = forecast?.contacts_limit ?? selectedFixture?.contacts_limit ?? null;
  const currentContacts = forecast?.current_contacts ?? selectedFixture?.contacts ?? 0;

  // --- Forecast confidence (E3 guardrail) computed from series density in lookback window ---
  const forecastConfidence = useMemo(() => {
    // Count how many distinct hourly buckets exist within last lookbackHours
    const now = new Date();
    const cutoff = new Date(now.getTime() - Math.max(1, lookbackHours) * 3600 * 1000);

    const buckets = (Array.isArray(series) ? series : [])
      .map((p) => parseChartTsToDate(p.sample_ts))
      .filter((d): d is Date => !!d && d >= cutoff && d <= now)
      .map((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`);

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
    return events.filter((e) => classifyEventType(e.event_type) === eventFilter);
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

  const chartData: ChartRow[] = useMemo(() => {
    const base: ChartRow[] = (Array.isArray(series) ? series : []).map((p, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      const delta = prev ? Number(p.contacts ?? 0) - Number(prev.contacts ?? 0) : null;
      return {
        ...p,
        delta_h: delta != null && Number.isFinite(delta) ? delta : null,
        forecast_warn: null,
        forecast_limit: null,
      };
    });

    if (!base.length) return base;

    const last = base[base.length - 1];
    const lastD = parseChartTsToDate(last.sample_ts);
    if (!lastD) return base;

    const lastContacts = Number(last.contacts ?? 0);
    const rate = Number(forecast?.avg_contacts_per_hour ?? 0);

    const etaW = forecast?.eta_warning_hours;
    const etaL = forecast?.eta_limit_hours;

    const makeTs = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
    };

    const out = [...base];

    // Warning forecast
    if (Number.isFinite(rate) && rate > 0 && etaW != null && Number.isFinite(etaW) && etaW > 0 && warningLine != null) {
      out[out.length - 1] = { ...out[out.length - 1], forecast_warn: lastContacts };
      const dt = new Date(lastD.getTime() + etaW * 3600 * 1000);
      out.push({
        ...last,
        sample_ts: makeTs(dt),
        contacts: Number(warningLine),
        delta_h: null,
        forecast_warn: Number(warningLine),
        forecast_limit: null,
      });
    }

    // Limit forecast
    if (Number.isFinite(rate) && rate > 0 && etaL != null && Number.isFinite(etaL) && etaL > 0 && limitLine != null) {
      // ensure start point set (might already have forecast_warn)
      out[out.length - 1] = { ...out[out.length - 1], forecast_limit: lastContacts };
      const dt = new Date(lastD.getTime() + etaL * 3600 * 1000);
      out.push({
        ...last,
        sample_ts: makeTs(dt),
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

    return out;
  }, [series, forecast, warningLine, limitLine]);

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
    gridTemplateColumns:
      "minmax(180px, 260px) minmax(320px, 1fr) minmax(220px, 360px) minmax(220px, 360px) minmax(160px, 220px) minmax(160px, 220px) minmax(180px, 280px)",
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

  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.85, color: "#fff", display: "flex", alignItems: "center" };

  const chartHeight = 340; // stable height

  const canRenderChart = mounted && tab === "overview" && chartBox.width > 10 && chartHeight > 10 && chartData.length > 0;

  return (
    <div className="mx-4 my-4" style={{ minWidth: 0 }}>
      <h2 style={{ marginBottom: 12, color: "#fff" }}>Analytics</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setTab("overview")}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: tab === "overview" ? "rgba(255,255,255,0.16)" : "transparent",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("probe")}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: tab === "probe" ? "rgba(255,255,255,0.16)" : "transparent",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          Probe demand
        </button>
      </div>

      {/* Filters */}
      <div style={filterGridStyle}>
        <div>
          <div style={labelStyle}>
            Plant <Hint text="Select plant. Engineers usually see only their plant. Admin can switch." />
          </div>
          <select value={selectedPlant} onChange={(e) => setSelectedPlant(e.target.value)} style={fieldStyle}>
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
            Fixture search <Hint text="Type project / adapter / type. Press Esc to clear. Press / to focus from anywhere." />
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
          <div className="label" style={{ marginTop: 6, color: "#fff", opacity: 0.85 }}>
            {selectedFixture ? (
              <>
                Selected: {selectedFixture.project_name} — {selectedFixture.adapter_code} / {selectedFixture.fixture_type}
              </>
            ) : (
              <>No fixture selected</>
            )}
          </div>
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <div style={labelStyle}>
            Fixture <Hint text="Dropdown is filtered by the search box. It won’t move around while typing." />
          </div>
          <select value={selectedFixtureKey} onChange={(e) => setSelectedFixtureKey(e.target.value)} style={fieldStyle}>
            {filteredFixtures.length ? (
              filteredFixtures.map((x) => (
                <option key={x.entry_id} value={`${x.adapter_code}||${x.fixture_type}`}>
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
            Forecast lookback <Hint text="Hours used for burn-rate calculation. Longer = smoother but slower to react." />
          </div>
          <select value={lookbackHours} onChange={(e) => setLookbackHours(Number(e.target.value))} style={fieldStyle}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={72}>72</option>
            <option value={168}>168 (7d)</option>
            <option value={336}>336 (14d)</option>
            <option value={720}>720 (30d)</option>
          </select>
        </div>

        <div>
          <div style={labelStyle}>
            Series range <Hint text="Time window shown in the chart. You can go up to 365 days." />
          </div>
          <select value={seriesHours} onChange={(e) => setSeriesHours(Number(e.target.value))} style={fieldStyle}>
            <option value={24}>24</option>
            <option value={72}>72</option>
            <option value={168}>168 (7d)</option>
            <option value={336}>336 (14d)</option>
            <option value={720}>720 (30d)</option>
            <option value={1440}>1440 (60d)</option>
            <option value={2160}>2160 (90d)</option>
            <option value={8760}>8760 (365d)</option>
          </select>
        </div>

        <div>
          <button
            onClick={loadAnalytics}
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

          {lastLoadedAt ? (
            <div className="label" style={{ marginTop: 6, color: "#fff", opacity: 0.85 }}>
              Last refresh: {lastLoadedAt}
            </div>
          ) : null}
        </div>
      </div>

      {err && (
        <div className="analytics-card" style={{ padding: 10, borderRadius: 12, marginBottom: 12 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 12 }}>
          <div className="analytics-card p-3 rounded text-white">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Probe demand totals (Next 7 days)</div>
            <div className="label" style={{ opacity: 0.9, marginBottom: 10 }}>
              Aggregated maintenance demand across fixtures in the selected plant.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th className="label" style={{ padding: "8px 6px" }}>Part number</th>
                    <th className="label" style={{ padding: "8px 6px" }}>Total qty</th>
                    <th className="label" style={{ padding: "8px 6px" }}>Fixtures</th>
                  </tr>
                </thead>
                <tbody>
                  {demandWeek.length ? (
                    demandWeek.slice(0, 25).map((r) => (
                      <tr key={`w-${r.part_number}`} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        <td style={{ padding: "8px 6px" }}>{r.part_number}</td>
                        <td style={{ padding: "8px 6px" }}>{r.total_qty}</td>
                        <td style={{ padding: "8px 6px" }}>{r.fixtures}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td className="label" style={{ padding: 8 }} colSpan={3}>No predicted maintenance this week.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="analytics-card p-3 rounded text-white">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Probe demand totals (Next 30 days)</div>
            <div className="label" style={{ opacity: 0.9, marginBottom: 10 }}>
              Good for planning orders / stock.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th className="label" style={{ padding: "8px 6px" }}>Part number</th>
                    <th className="label" style={{ padding: "8px 6px" }}>Total qty</th>
                    <th className="label" style={{ padding: "8px 6px" }}>Fixtures</th>
                  </tr>
                </thead>
                <tbody>
                  {demandMonth.length ? (
                    demandMonth.slice(0, 25).map((r) => (
                      <tr key={`m-${r.part_number}`} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        <td style={{ padding: "8px 6px" }}>{r.part_number}</td>
                        <td style={{ padding: "8px 6px" }}>{r.total_qty}</td>
                        <td style={{ padding: "8px 6px" }}>{r.fixtures}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td className="label" style={{ padding: 8 }} colSpan={3}>No predicted maintenance this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB: OVERVIEW */}
      {tab === "overview" ? (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Current</div>
              <div className="value" style={{ fontSize: 22 }}>{currentContacts}</div>
              <div className="label" style={{ marginTop: 6 }}>
                warning: {warningLine ?? "—"} · limit: {limitLine ?? "—"}
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>Burn rate</span>
                <span title="How reliable is the burn-rate? Based on how many hourly samples exist in the lookback window."
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.10)",
                    fontSize: 12,
                    whiteSpace: "nowrap"
                  }}
                >
                  {forecastConfidence.label} · {forecastConfidence.detail}
                </span>
              </div>
              <div className="value" style={{ fontSize: 22 }}>{fmtRate(forecast?.avg_contacts_per_hour)}</div>
              <div className="label" style={{ marginTop: 6 }}>
                window: {forecast?.window_start ? safeStr(forecast.window_start) : "—"} → {forecast?.window_end ? safeStr(forecast.window_end) : "—"}
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label">ETA to warning</div>
              <div className="value" style={{ fontSize: 22 }}>{fmtHours(forecast?.eta_warning_hours)}</div>
              <div className="label" style={{ marginTop: 6 }}>based on avg positive deltas</div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label">ETA to limit</div>
              <div className="value" style={{ fontSize: 22 }}>{fmtHours(forecast?.eta_limit_hours)}</div>
              <div className="label" style={{ marginTop: 6 }}>based on avg positive deltas</div>
            </div>
          </div>

          {/* Chart options */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Chart options</div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={showDeltaLine} onChange={(e) => setShowDeltaLine(e.target.checked)} />
                <span>
                  Show <b>Δ/h</b> line (recommended when contacts are high and look flat)
                </span>
              </label>
              <div className="label" style={{ marginTop: 10, opacity: 0.9 }}>
                Forecast lines are drawn using burn rate and ETA. Dashed reference lines show warning/limit thresholds.
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Plant daily overview (last 14 days)</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th className="label" style={{ padding: "8px 6px" }}>Day</th>
                      <th className="label" style={{ padding: "8px 6px" }}>Resets</th>
                      <th className="label" style={{ padding: "8px 6px" }}>TP events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.length ? (
                      daily.map((d) => (
                        <tr key={d.day} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                          <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{d.day}</td>
                          <td style={{ padding: "8px 6px" }}>{Number(d.resets ?? 0)}</td>
                          <td style={{ padding: "8px 6px" }}>{Number(d.tp_events ?? 0)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td className="label" style={{ padding: 8 }} colSpan={3}>No daily data.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="analytics-card p-3 rounded text-white" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>Contacts (hourly) + Forecast</div>
              <div className="label" style={{ opacity: 0.9 }}>
                {showDeltaLine ? "Δ/h helps visualize activity" : "Tip: enable Δ/h when line looks flat"}
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
                <LineChart width={chartBox.width} height={chartHeight} data={chartData}>
                  <CartesianGrid />
                  <XAxis dataKey="sample_ts" tick={{ fontSize: 11 }} minTickGap={22} />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  {showDeltaLine ? <YAxis yAxisId="delta" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} /> : null}

                  <Tooltip />
                  <Legend />

                  {typeof warningLine === "number" && warningLine > 0 ? <ReferenceLine y={warningLine} strokeDasharray="6 4" /> : null}
                  {typeof limitLine === "number" && limitLine > 0 ? <ReferenceLine y={limitLine} strokeDasharray="6 4" /> : null}

                  <Line type="monotone" dataKey="contacts" dot={false} name="Contacts" />
                  {showDeltaLine ? <Line type="monotone" dataKey="delta_h" yAxisId="delta" dot={false} name="Δ/h" connectNulls /> : null}

                  <Line type="monotone" dataKey="forecast_warn" dot={false} name="Forecast → Warning" connectNulls strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="forecast_limit" dot={false} name="Forecast → Limit" connectNulls strokeDasharray="4 4" />
                </LineChart>
              ) : (
                <div className="label" style={{ padding: "10px 0" }}>
                  {mounted ? "No samples for the selected range (or chart is measuring…)" : "Loading chart…"}
                </div>
              )}
            </div>

            <div className="label" style={{ marginTop: 8 }}>
              Dashed horizontal lines: warning / limit. Forecast lines use burn rate + ETA.
            </div>
          </div>

          {/* Events */}
          <div className="analytics-card p-3 rounded text-white">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>Recent events</div>

              {/* Legend chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={() => setEventFilter("ALL")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: eventFilter === "ALL" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
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
                    <th className="label" style={{ padding: "8px 6px", cursor: "pointer" }} onClick={() => toggleSort("created_at")}>Date</th>
                    <th className="label" style={{ padding: "8px 6px" }}>Time</th>
                    <th className="label" style={{ padding: "8px 6px", cursor: "pointer" }} onClick={() => toggleSort("event_type")}>Type</th>
                    <th className="label" style={{ padding: "8px 6px", cursor: "pointer" }} onClick={() => toggleSort("event_details")}>Details</th>
                    <th className="label" style={{ padding: "8px 6px", cursor: "pointer" }} onClick={() => toggleSort("old_value")}>Old</th>
                    <th className="label" style={{ padding: "8px 6px", cursor: "pointer" }} onClick={() => toggleSort("new_value")}>New</th>
                    <th className="label" style={{ padding: "8px 6px", cursor: "pointer" }} onClick={() => toggleSort("actor")}>Actor</th>
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
                          <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{dt.date}</td>
                          <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{dt.time}</td>
                          <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
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
                          <td style={{ padding: "8px 6px" }}>{e.event_details ?? ""}</td>
                          <td style={{ padding: "8px 6px" }}>{e.old_value ?? ""}</td>
                          <td style={{ padding: "8px 6px" }}>{e.new_value ?? ""}</td>
                          <td style={{ padding: "8px 6px" }}>{e.actor ?? ""}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td style={{ padding: 8 }} className="label" colSpan={7}>No events.</td></tr>
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
