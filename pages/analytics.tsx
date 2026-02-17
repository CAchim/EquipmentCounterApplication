import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const ReferenceDot = dynamic(() => import("recharts").then((m) => m.ReferenceDot), { ssr: false });

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
};

type SeriesPoint = {
  sample_ts: string;
  contacts: number;
  warning_at: number;
  contacts_limit: number;
  resets: number;

  // UI-only derived fields:
  delta?: number;
  forecast_contacts?: number;
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
type TabKey = "overview" | "demand";

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
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatHourTs(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:00`;
}
function parseHourTs(s: string) {
  const [date, time] = s.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const hh = Number((time || "00:00").split(":")[0] || 0);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, 0, 0, 0);
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

function useElementSize<T extends HTMLElement>() {
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
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...size };
}

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [chartReady, setChartReady] = useState(false);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<string>("Timisoara");

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedFixtureKey, setSelectedFixtureKey] = useState<string>("");

  const [fixtureSearch, setFixtureSearch] = useState<string>("");

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

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showDeltaLine, setShowDeltaLine] = useState<boolean>(true);
  const [showForecastLine, setShowForecastLine] = useState<boolean>(true);

  const chartBox = useElementSize<HTMLDivElement>();

  useEffect(() => {
    setMounted(true);
    // One more RAF to avoid the ResponsiveContainer "negative size" during first layout.
    requestAnimationFrame(() => requestAnimationFrame(() => setChartReady(true)));
  }, []);

  const fixtureDisplay = (x: Fixture) => `${x.project_name} — ${x.adapter_code} / ${x.fixture_type}`;

  // Display -> key
  const displayToKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fixtures) {
      m.set(fixtureDisplay(f), `${f.adapter_code}||${f.fixture_type}`);
    }
    return m;
  }, [fixtures]);

  // Single search field filter
  const filteredFixtures = useMemo(() => {
    const q = fixtureSearch.trim().toLowerCase();
    if (!q) return fixtures;
    return fixtures.filter((x) => {
      const hay = `${x.project_name} ${x.adapter_code} ${x.fixture_type}`.toLowerCase();
      return hay.includes(q);
    });
  }, [fixtures, fixtureSearch]);

  // Selected fixture object
  const selectedFixture = useMemo(() => {
    const [a, f] = selectedFixtureKey.split("||");
    return fixtures.find((x) => x.adapter_code === a && x.fixture_type === f) || null;
  }, [fixtures, selectedFixtureKey]);

  // keep selection valid even when search hides it
  useEffect(() => {
    if (!filteredFixtures.length) return;
    const exists = filteredFixtures.some((x) => `${x.adapter_code}||${x.fixture_type}` === selectedFixtureKey);
    if (!selectedFixtureKey || !exists) {
      const first = filteredFixtures[0];
      setSelectedFixtureKey(`${first.adapter_code}||${first.fixture_type}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFixtures]);

  // if user didn’t type anything, show selected label in the search box
  useEffect(() => {
    if (!selectedFixture) return;
    if (fixtureSearch.trim()) return;
    setFixtureSearch(fixtureDisplay(selectedFixture));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFixtureKey]);

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
        const j = await fetchJson<{ fixtures: Fixture[] }>(
          `/api/analytics/fixtures?plant=${encodeURIComponent(selectedPlant)}`
        );
        const list = Array.isArray(j.fixtures) ? j.fixtures : [];
        setFixtures(list);

        if (!selectedFixtureKey && list.length) {
          const first = list[0];
          setSelectedFixtureKey(`${first.adapter_code}||${first.fixture_type}`);
        }
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
        setErr(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlant]);

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
        fetchJson<{ forecast: ForecastRow | null }>(
          `/api/analytics/forecast?${base}&lookback=${encodeURIComponent(String(lookbackHours))}`
        ),
        fetchJson<{ series: SeriesPoint[] }>(
          `/api/analytics/series?${base}&hours=${encodeURIComponent(String(seriesHours))}`
        ),
        fetchJson<{ events: EventRow[] }>(`/api/analytics/events?${base}&limit=80`),
        fetchJson<{ daily: DailyRow[] }>(
          `/api/analytics/plant-daily?plant=${encodeURIComponent(selectedPlant)}&days=14`
        ),
        fetchJson<{
          week: { demandByPn: DemandAggRow[] };
          month: { demandByPn: DemandAggRow[] };
        }>(
          `/api/analytics/probe-demand?plant=${encodeURIComponent(selectedPlant)}&lookback=${encodeURIComponent(
            String(lookbackHours)
          )}`
        ),
      ]);

      setForecast(jf.forecast ?? null);

      const baseSeries = Array.isArray(js.series) ? js.series : [];
      const withDelta: SeriesPoint[] = baseSeries.map((p, idx) => {
        const prev = idx > 0 ? baseSeries[idx - 1] : null;
        const delta = prev ? Number(p.contacts ?? 0) - Number(prev.contacts ?? 0) : 0;
        return { ...p, delta: Number.isFinite(delta) ? delta : 0 };
      });
      setSeries(withDelta);

      setEvents(Array.isArray(je.events) ? je.events : []);
      setDaily(Array.isArray(jd.daily) ? jd.daily : []);
      setDemandWeek(Array.isArray(jdem.week?.demandByPn) ? jdem.week.demandByPn : []);
      setDemandMonth(Array.isArray(jdem.month?.demandByPn) ? jdem.month.demandByPn : []);

      setLastLoadedAt(new Date().toLocaleString());
    } catch (e: any) {
      setErr(String(e?.message || e));
      setForecast(null);
      setSeries([]);
      setEvents([]);
      setDaily([]);
      setDemandWeek([]);
      setDemandMonth([]);
      setLastLoadedAt("");
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

  const chartData = useMemo(() => {
    const base = series || [];
    if (!base.length) return [];

    if (!showForecastLine) return base;

    const rate = Number(forecast?.avg_contacts_per_hour);
    if (!Number.isFinite(rate) || rate <= 0) return base;

    const last = base[base.length - 1];
    const lastTs = parseHourTs(last.sample_ts);
    const lastContacts = Number(last.contacts ?? 0);

    const lim = typeof limitLine === "number" ? limitLine : null;
    const maxHours = Math.min(24 * 30, Math.max(24, seriesHours));
    const projected: SeriesPoint[] = [];

    for (let i = 1; i <= maxHours; i++) {
      const d = new Date(lastTs.getTime());
      d.setHours(d.getHours() + i);
      const c = lastContacts + rate * i;

      projected.push({
        sample_ts: formatHourTs(d),
        contacts: NaN as any,
        warning_at: last.warning_at,
        contacts_limit: last.contacts_limit,
        resets: last.resets,
        delta: undefined,
        forecast_contacts: c,
      });

      if (lim != null && Number.isFinite(lim) && c >= lim) break;
    }

    return [...base, ...projected];
  }, [series, forecast?.avg_contacts_per_hour, showForecastLine, limitLine, seriesHours]);

  const etaWarnTs = useMemo(() => {
    const h = forecast?.eta_warning_hours;
    if (h == null || !Number.isFinite(h) || h <= 0) return null;
    if (!series?.length) return null;
    const last = series[series.length - 1];
    const lastTs = parseHourTs(last.sample_ts);
    const d = new Date(lastTs.getTime());
    d.setHours(d.getHours() + Math.ceil(h));
    return formatHourTs(d);
  }, [forecast?.eta_warning_hours, series]);

  const etaLimitTs = useMemo(() => {
    const h = forecast?.eta_limit_hours;
    if (h == null || !Number.isFinite(h) || h <= 0) return null;
    if (!series?.length) return null;
    const last = series[series.length - 1];
    const lastTs = parseHourTs(last.sample_ts);
    const d = new Date(lastTs.getTime());
    d.setHours(d.getHours() + Math.ceil(h));
    return formatHourTs(d);
  }, [forecast?.eta_limit_hours, series]);

  // Contacts Y-domain with padding
  const yDomainContacts = useMemo(() => {
    return [
      (min: number) => {
        if (!Number.isFinite(min)) return 0;
        const pad = Math.max(10, Math.abs(min) * 0.01);
        return Math.max(0, min - pad);
      },
      (max: number) => {
        if (!Number.isFinite(max)) return "auto";
        const pad = Math.max(10, Math.abs(max) * 0.01);
        return max + pad;
      },
    ] as any;
  }, []);

  const sortedEvents = useMemo(() => {
    const dir = eventSortDir === "asc" ? 1 : -1;
    const arr = [...events];

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
  }, [events, eventSortKey, eventSortDir]);

  function toggleSort(k: SortKey) {
    if (eventSortKey !== k) {
      setEventSortKey(k);
      setEventSortDir("asc");
      return;
    }
    setEventSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  const helpIcon = (title: string) => (
    <span
      title={title}
      style={{
        marginLeft: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: 99,
        border: "1px solid rgba(255,255,255,0.45)",
        fontSize: 11,
        cursor: "help",
        opacity: 0.9,
      }}
    >
      ?
    </span>
  );

  // Shared field wrapper -> guarantees alignment
  const Field: React.FC<{
    label: React.ReactNode;
    helper?: React.ReactNode;
    children: React.ReactNode;
    span?: number;
  }> = ({ label, helper, children, span }) => {
    return (
      <div style={{ display: "grid", gridTemplateRows: "18px 38px 18px", gap: 6, gridColumn: span ? `span ${span}` : undefined }}>
        <div style={{ fontSize: 12, opacity: 0.85, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>{children}</div>
        <div className="label" style={{ color: "#fff", opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {helper ?? "\u00A0" /* reserved space */}
        </div>
      </div>
    );
  };

  // Chart render gate (kills the -1/-1 warning)
  const canRenderChart =
    mounted &&
    chartReady &&
    chartBox.width > 50 &&
    chartBox.height > 50 &&
    Array.isArray(chartData) &&
    chartData.length > 0;

  return (
    <div className="mx-4 my-4">
      <h2 style={{ marginBottom: 12, color: "#fff" }}>Analytics</h2>

      {/* Filters: aligned */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 260px) 1fr minmax(220px, 320px) minmax(220px, 320px) minmax(200px, 240px)",
          gap: 12,
          alignItems: "end",
          marginBottom: 14,
        }}
      >
        <Field
          label={
            <>
              Plant {helpIcon("Select which plant you are viewing.")}
            </>
          }
        >
          <select
            value={selectedPlant}
            onChange={(e) => {
              setSelectedPlant(e.target.value);
              setSelectedFixtureKey("");
              setForecast(null);
              setSeries([]);
              setEvents([]);
              setDaily([]);
              setDemandWeek([]);
              setDemandMonth([]);
              setLastLoadedAt("");
              setFixtureSearch("");
            }}
            style={{ padding: "8px 10px", width: "100%" }}
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
        </Field>

        <Field
          span={1}
          label={
            <>
              Fixture (search by project / adapter / type){" "}
              {helpIcon("Type any part of project name, adapter code, or fixture type. Select from suggestions.")}
            </>
          }
          helper={selectedFixture ? `Selected: ${fixtureDisplay(selectedFixture)}` : "\u00A0"}
        >
          <div style={{ width: "100%" }}>
            <input
              list="fixtureList"
              value={fixtureSearch}
              onChange={(e) => {
                const v = e.target.value;
                setFixtureSearch(v);
                const k = displayToKey.get(v);
                if (k) setSelectedFixtureKey(k);
              }}
              placeholder="Type: project / adapter / fixture..."
              style={{ padding: "8px 10px", width: "100%" }}
            />
            <datalist id="fixtureList">
              {filteredFixtures.slice(0, 250).map((x) => (
                <option key={x.entry_id} value={fixtureDisplay(x)} />
              ))}
            </datalist>
          </div>
        </Field>

        <Field
          label={
            <>
              Forecast lookback (hours){" "}
              {helpIcon("Window used to compute burn rate. Larger = smoother, smaller = more reactive.")}
            </>
          }
        >
          <select value={lookbackHours} onChange={(e) => setLookbackHours(Number(e.target.value))} style={{ padding: "8px 10px", width: "100%" }}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={72}>72</option>
            <option value={168}>168 (7d)</option>
            <option value={336}>336 (14d)</option>
            <option value={720}>720 (30d)</option>
          </select>
        </Field>

        <Field
          label={
            <>
              Series range (hours) {helpIcon("How far back the chart should go.")}
            </>
          }
        >
          <select value={seriesHours} onChange={(e) => setSeriesHours(Number(e.target.value))} style={{ padding: "8px 10px", width: "100%" }}>
            <option value={24}>24</option>
            <option value={72}>72</option>
            <option value={168}>168 (7d)</option>
            <option value={336}>336 (14d)</option>
            <option value={720}>720 (30d)</option>
            <option value={1440}>1440 (60d)</option>
            <option value={2160}>2160 (90d)</option>
            <option value={8760}>8760 (365d)</option>
          </select>
        </Field>

        <Field
          label={<>&nbsp;</>}
          helper={lastLoadedAt ? `Last refresh: ${lastLoadedAt}` : "\u00A0"}
        >
          <button
            onClick={loadAnalytics}
            disabled={loading || !selectedFixture}
            title="Reload everything: forecast, series, events, daily overview, probe demand."
            style={{ padding: "8px 14px", width: "100%" }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </Field>
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: activeTab === "overview" ? "rgba(255,255,255,0.10)" : "transparent",
            color: "#fff",
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("demand")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: activeTab === "demand" ? "rgba(255,255,255,0.10)" : "transparent",
            color: "#fff",
          }}
        >
          Probe demand
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ color: "#fff", opacity: 0.9, fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={showForecastLine} onChange={(e) => setShowForecastLine(e.target.checked)} />
            Forecast line
          </label>
          <label style={{ color: "#fff", opacity: 0.9, fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={showDeltaLine} onChange={(e) => setShowDeltaLine(e.target.checked)} />
            Delta/h line
          </label>
        </div>
      </div>

      {activeTab === "overview" ? (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Current</div>
              <div className="value" style={{ fontSize: 22 }}>
                {currentContacts}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                warning: {warningLine ?? "—"} · limit: {limitLine ?? "—"}
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label">Burn rate</div>
              <div className="value" style={{ fontSize: 22 }}>
                {fmtRate(forecast?.avg_contacts_per_hour)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                window: {forecast?.window_start ? safeStr(forecast.window_start) : "—"} →{" "}
                {forecast?.window_end ? safeStr(forecast.window_end) : "—"}
              </div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label">ETA to warning</div>
              <div className="value" style={{ fontSize: 22 }}>
                {fmtHours(forecast?.eta_warning_hours)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>based on avg positive deltas</div>
            </div>

            <div className="analytics-card p-3 rounded text-white">
              <div className="label">ETA to limit</div>
              <div className="value" style={{ fontSize: 22 }}>
                {fmtHours(forecast?.eta_limit_hours)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>based on avg positive deltas</div>
            </div>
          </div>

          {/* Chart */}
          <div className="analytics-card p-3 rounded text-white" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Contacts (hourly) + Forecast</div>

            <div
              ref={chartBox.ref}
              style={{
                width: "100%",
                minWidth: 0,
                // height is driven by aspect to avoid 0/-1 issues
              }}
            >
              {canRenderChart ? (
                <ResponsiveContainer width="100%" aspect={3}>
                  <LineChart data={chartData}>
                    <CartesianGrid />
                    <XAxis dataKey="sample_ts" tick={{ fontSize: 11 }} minTickGap={20} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} domain={yDomainContacts} />
                    {showDeltaLine ? <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} /> : null}
                    <Tooltip />
                    <Legend />

                    {typeof warningLine === "number" && warningLine > 0 ? <ReferenceLine yAxisId="left" y={warningLine} strokeDasharray="6 4" /> : null}
                    {typeof limitLine === "number" && limitLine > 0 ? <ReferenceLine yAxisId="left" y={limitLine} strokeDasharray="6 4" /> : null}

                    <Line yAxisId="left" type="monotone" dataKey="contacts" name="Contacts" dot={false} />

                    {showForecastLine ? (
                      <Line yAxisId="left" type="monotone" dataKey="forecast_contacts" name="Forecast (projection)" dot={false} strokeDasharray="6 4" />
                    ) : null}

                    {showDeltaLine ? (
                      <Line yAxisId="right" type="monotone" dataKey="delta" name="Delta / hour" dot={false} />
                    ) : null}

                    {showForecastLine && etaWarnTs && typeof warningLine === "number" ? (
                      <ReferenceDot x={etaWarnTs} y={warningLine} yAxisId="left" r={5} label={{ value: "ETA warn", position: "top" }} />
                    ) : null}

                    {showForecastLine && etaLimitTs && typeof limitLine === "number" ? (
                      <ReferenceDot x={etaLimitTs} y={limitLine} yAxisId="left" r={5} label={{ value: "ETA limit", position: "top" }} />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="label" style={{ padding: "10px 0" }}>
                  {chartData.length ? "Chart container not ready yet..." : "No samples for the selected range."}
                </div>
              )}
            </div>

            <div className="label" style={{ marginTop: 10 }}>
              Tip: enable “Delta/h line” when contacts are very high and look flat; it highlights activity per hour.
            </div>
          </div>

          {/* Events */}
          <div className="analytics-card p-3 rounded text-white">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent events</div>

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
                    sortedEvents.map((e, idx) => {
                      const dt = splitDateTime(e.created_at);
                      return (
                        <tr key={e.entry_id} style={{ borderTop: "1px solid rgba(255,255,255,0.10)", background: idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                          <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{dt.date}</td>
                          <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{dt.time}</td>
                          <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{e.event_type}</td>
                          <td style={{ padding: "8px 6px" }}>{e.event_details ?? ""}</td>
                          <td style={{ padding: "8px 6px" }}>{e.old_value ?? ""}</td>
                          <td style={{ padding: "8px 6px" }}>{e.new_value ?? ""}</td>
                          <td style={{ padding: "8px 6px" }}>{e.actor ?? ""}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td style={{ padding: 8 }} className="label" colSpan={7}>No events.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Demand tab */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 12 }}>
            <div className="analytics-card p-3 rounded text-white">
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Probe demand totals (Next 7 days)</div>
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
                      demandWeek.slice(0, 30).map((r, idx) => (
                        <tr key={`w-${r.part_number}`} style={{ borderTop: "1px solid rgba(255,255,255,0.10)", background: idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent" }}>
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
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Probe demand totals (Next 30 days)</div>
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
                      demandMonth.slice(0, 30).map((r, idx) => (
                        <tr key={`m-${r.part_number}`} style={{ borderTop: "1px solid rgba(255,255,255,0.10)", background: idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent" }}>
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
        </>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
