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
  // supports "YYYY-MM-DD HH:mm:ss" or ISO
  const m = s.replace("T", " ").split(".");
  const base = m[0];
  const parts = base.split(" ");
  if (parts.length >= 2) return { date: parts[0], time: parts[1] };
  return { date: base, time: "" };
}

/** Robust fetch JSON (prevents Unexpected token '<' when 404 HTML page is returned) */
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

type SortKey = "created_at" | "event_type" | "actor" | "old_value" | "new_value" | "event_details";
type SortDir = "asc" | "desc";

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<string>("Timisoara");

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedFixtureKey, setSelectedFixtureKey] = useState<string>("");

  const [projectFilter, setProjectFilter] = useState("");
  const [adapterFilter, setAdapterFilter] = useState("");
  const [fixtureFilter, setFixtureFilter] = useState("");

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

  const chartBox = useElementSize<HTMLDivElement>();

  useEffect(() => setMounted(true), []);

  // Load plants (engineer will receive only 1 plant from API)
  useEffect(() => {
    (async () => {
      try {
        const j = await fetchJson<{ plants: Plant[] }>("/api/analytics/plants");
        const list = Array.isArray(j.plants) ? j.plants : [];
        setPlants(list);

        // if API returns exactly one plant, force-select it
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

  const filteredFixtures = useMemo(() => {
    const pf = projectFilter.trim().toLowerCase();
    const af = adapterFilter.trim().toLowerCase();
    const ff = fixtureFilter.trim().toLowerCase();

    return fixtures.filter((x) => {
      if (pf && !String(x.project_name ?? "").toLowerCase().includes(pf)) return false;
      if (af && !String(x.adapter_code ?? "").toLowerCase().includes(af)) return false;
      if (ff && !String(x.fixture_type ?? "").toLowerCase().includes(ff)) return false;
      return true;
    });
  }, [fixtures, projectFilter, adapterFilter, fixtureFilter]);

  // ✅ Keep selection valid when filters change (prevents "page looks broken")
  useEffect(() => {
    if (!filteredFixtures.length) return;

    const exists = filteredFixtures.some(
      (x) => `${x.adapter_code}||${x.fixture_type}` === selectedFixtureKey
    );

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
      setSeries(Array.isArray(js.series) ? js.series : []);
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

  // auto-load when selection changes
  useEffect(() => {
    if (selectedFixture) loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFixtureKey, lookbackHours, seriesHours]);

  const warningLine = forecast?.warning_at ?? selectedFixture?.warning_at ?? null;
  const limitLine = forecast?.contacts_limit ?? selectedFixture?.contacts_limit ?? null;
  const currentContacts = forecast?.current_contacts ?? selectedFixture?.contacts ?? 0;

  const sortedEvents = useMemo(() => {
    const dir = eventSortDir === "asc" ? 1 : -1;
    const arr = [...events];

    arr.sort((a, b) => {
      const av = (a as any)[eventSortKey];
      const bv = (b as any)[eventSortKey];

      // created_at sort by date
      if (eventSortKey === "created_at") {
        const ad = new Date(String(av ?? "")).getTime() || 0;
        const bd = new Date(String(bv ?? "")).getTime() || 0;
        return (ad - bd) * dir;
      }

      // numeric-ish columns
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

  return (
    <div className="mx-4 my-4">
      <h2 style={{ marginBottom: 12, color: "#fff" }}>Analytics</h2>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#fff" }}>Plant</div>
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
            }}
            style={{ padding: "8px 10px", minWidth: 200 }}
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
          <div style={{ fontSize: 12, opacity: 0.85, color: "#fff" }}>Search Project</div>
          <input
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            placeholder="project name..."
            style={{ padding: "8px 10px", minWidth: 220 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#fff" }}>Search Adapter</div>
          <input
            value={adapterFilter}
            onChange={(e) => setAdapterFilter(e.target.value)}
            placeholder="adapter code..."
            style={{ padding: "8px 10px", minWidth: 160 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#fff" }}>Search Fixture Type</div>
          <input
            value={fixtureFilter}
            onChange={(e) => setFixtureFilter(e.target.value)}
            placeholder="fixture type..."
            style={{ padding: "8px 10px", minWidth: 160 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#fff" }}>Fixture</div>
          <select
            value={selectedFixtureKey}
            onChange={(e) => setSelectedFixtureKey(e.target.value)}
            style={{ padding: "8px 10px", minWidth: 420, maxWidth: "80vw" }}
          >
            {filteredFixtures.map((x) => (
              <option key={x.entry_id} value={`${x.adapter_code}||${x.fixture_type}`}>
                {x.project_name} — {x.adapter_code} / {x.fixture_type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#fff" }}>Forecast lookback (hours)</div>
          <select
            value={lookbackHours}
            onChange={(e) => setLookbackHours(Number(e.target.value))}
            style={{ padding: "8px 10px" }}
          >
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
          <div style={{ fontSize: 12, opacity: 0.85, color: "#fff" }}>Series range (hours)</div>
          <select
            value={seriesHours}
            onChange={(e) => setSeriesHours(Number(e.target.value))}
            style={{ padding: "8px 10px" }}
          >
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

        <div style={{ alignSelf: "flex-end" }}>
          <button onClick={loadAnalytics} disabled={loading || !selectedFixture} style={{ padding: "8px 14px" }}>
            {loading ? "Loading..." : "Refresh"}
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
          <div className="label" style={{ marginTop: 6 }}>
            based on avg positive deltas
          </div>
        </div>

        <div className="analytics-card p-3 rounded text-white">
          <div className="label">ETA to limit</div>
          <div className="value" style={{ fontSize: 22 }}>
            {fmtHours(forecast?.eta_limit_hours)}
          </div>
          <div className="label" style={{ marginTop: 6 }}>
            based on avg positive deltas
          </div>
        </div>
      </div>

      {/* Daily overview + Demand */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div className="analytics-card p-3 rounded text-white">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Plant daily overview (last 14 days)</div>
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
                    <tr key={d.day} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                      <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{d.day}</td>
                      <td style={{ padding: "8px 6px" }}>{Number(d.resets ?? 0)}</td>
                      <td style={{ padding: "8px 6px" }}>{Number(d.tp_events ?? 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="label" style={{ padding: 8 }} colSpan={3}>
                      No daily data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="analytics-card p-3 rounded text-white">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Probe demand totals (maintenance)</div>

          <div className="label" style={{ marginBottom: 6 }}>Next 7 days</div>
          <div style={{ overflowX: "auto", marginBottom: 10 }}>
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
                  demandWeek.slice(0, 12).map((r) => (
                    <tr key={`w-${r.part_number}`} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                      <td style={{ padding: "8px 6px" }}>{r.part_number}</td>
                      <td style={{ padding: "8px 6px" }}>{r.total_qty}</td>
                      <td style={{ padding: "8px 6px" }}>{r.fixtures}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="label" style={{ padding: 8 }} colSpan={3}>
                      No predicted maintenance this week.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="label" style={{ marginBottom: 6 }}>Next 30 days</div>
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
                  demandMonth.slice(0, 12).map((r) => (
                    <tr key={`m-${r.part_number}`} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                      <td style={{ padding: "8px 6px" }}>{r.part_number}</td>
                      <td style={{ padding: "8px 6px" }}>{r.total_qty}</td>
                      <td style={{ padding: "8px 6px" }}>{r.fixtures}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="label" style={{ padding: 8 }} colSpan={3}>
                      No predicted maintenance this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="analytics-card p-3 rounded text-white" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Contacts (hourly)</div>

        <div ref={chartBox.ref} style={{ width: "100%", height: 320, minWidth: 0 }}>
          {/* Render only when mounted + container has valid dimensions */}
          {mounted && chartBox.width > 10 && chartBox.height > 10 && series.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid />
                <XAxis dataKey="sample_ts" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {typeof warningLine === "number" && warningLine > 0 ? <ReferenceLine y={warningLine} strokeDasharray="6 4" /> : null}
                {typeof limitLine === "number" && limitLine > 0 ? <ReferenceLine y={limitLine} strokeDasharray="6 4" /> : null}
                <Line type="monotone" dataKey="contacts" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="label" style={{ padding: "10px 0" }}>
              {series.length ? "Chart container not ready yet..." : "No samples for the selected range."}
            </div>
          )}
        </div>

        <div className="label" style={{ marginTop: 8 }}>Dashed lines: warning / limit.</div>
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
                sortedEvents.map((e) => {
                  const dt = splitDateTime(e.created_at);
                  return (
                    <tr key={e.entry_id} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
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
                  <td style={{ padding: 8 }} className="label" colSpan={7}>
                    No events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer missing: this is usually LayoutWrapper/_app styling,
          but adding a tiny spacer prevents “footer overlap” if background has glitches */}
      <div style={{ height: 20 }} />
    </div>
  );
}
