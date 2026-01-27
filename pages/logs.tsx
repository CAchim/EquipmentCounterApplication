import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "../components/layout";
import React from "react";
import { usePlant } from "../contexts/Plantcontext";

interface DbLogRow {
  [key: string]: any;
}

interface FixtureEventRow {
  [key: string]: any;
}

// Our datetime column in db_logs
const TIMESTAMP_KEY = "last_update";

type DateFilter = "all" | "24h" | "7d" | "30d" | "custom";
type GroupMode = "plain" | "equipment" | "day";

// 4 “main” action types you want to color + use as legend/filter
type ActionKey = "LIMIT_CHANGE" | "OWNER_CHANGE" | "CONTACTS_UPDATED" | "COUNTER_RESET" | "OTHER";

const ACTION_DEFS: Array<{
  key: ActionKey;
  label: string;
  // Strong button color (full color)
  btnBg: string;
  btnText: string;
  // “Pill” background in modal
  pillBg: string;
  pillText: string;
  // Matches db_action text
  match: (dbActionLower: string) => boolean;
}> = [
  {
    key: "LIMIT_CHANGE",
    label: "Limit & warning updated",
    btnBg: "#17a2b8",
    btnText: "#ffffff",
    pillBg: "rgba(23,162,184,0.15)",
    pillText: "#0b5360",
    match: (a) => a.startsWith("limit & warning updated"),
  },
  {
    key: "OWNER_CHANGE",
    label: "Owner email updated",
    btnBg: "#6f42c1",
    btnText: "#ffffff",
    pillBg: "rgba(111,66,193,0.14)",
    pillText: "#3b1b74",
    
    match: (a) => a.startsWith("owner email updated"),
  },
  {
    key: "CONTACTS_UPDATED",
    label: "Contacts updated",
    btnBg: "#28a745",
    btnText: "#ffffff",
    pillBg: "rgba(40,167,69,0.15)",
    pillText: "#155724",
    match: (a) => a.startsWith("contacts updated"),
  },
  {
    key: "COUNTER_RESET",
    label: "Counter reset",
    btnBg: "#ffc107",
    btnText: "#1f1f1f",
    pillBg: "rgba(255,193,7,0.18)",
    pillText: "#6b4f00",
    match: (a) => a.startsWith("counter reset"),
  },
  {
    key: "OTHER",
    label: "Other",
    btnBg: "#6c757d",
    btnText: "#ffffff",
    pillBg: "rgba(108,117,125,0.16)",
    pillText: "#343a40",
    match: (_a) => true,
  },
];

function safeLower(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function getActionKeyFromRow(row: DbLogRow): ActionKey {
  const a = safeLower(row?.db_action);
  for (const def of ACTION_DEFS) {
    if (def.key === "OTHER") continue;
    if (def.match(a)) return def.key;
  }
  return "OTHER";
}

function getActionDef(actionKey: ActionKey) {
  return ACTION_DEFS.find((d) => d.key === actionKey) || ACTION_DEFS[ACTION_DEFS.length - 1];
}

function buildCsv(rows: DbLogRow[], keys: string[], timestampKey: string) {
  // Expand timestamp into Date + Time like UI
  const header: string[] = ["#"];
  const csvKeys: Array<{ key: string; as: "single" | "date" | "time" }> = [];

  keys.forEach((k) => {
    if (k === timestampKey) {
      header.push("Date", "Time");
      csvKeys.push({ key: k, as: "date" }, { key: k, as: "time" });
    } else {
      header.push(k);
      csvKeys.push({ key: k, as: "single" });
    }
  });

  const escape = (val: any) => {
    const s = String(val ?? "");
    // Quote if contains comma, quote or newline
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines: string[] = [];
  lines.push(header.map(escape).join(","));

  rows.forEach((row, idx) => {
    const out: string[] = [];
    out.push(String(idx + 1));

    csvKeys.forEach(({ key, as }) => {
      if (key === timestampKey) {
        const tsRaw = row[timestampKey];
        const tsDate =
          tsRaw && !isNaN(new Date(tsRaw).getTime()) ? new Date(tsRaw) : null;

        if (as === "date") out.push(tsDate ? tsDate.toLocaleDateString() : "");
        else out.push(
          tsDate
            ? tsDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : ""
        );
        return;
      }

      out.push(row[key] !== null && row[key] !== undefined ? String(row[key]) : "");
    });

    lines.push(out.map(escape).join(","));
  });

  // Add BOM for Excel
  return "\ufeff" + lines.join("\n");
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const LogsPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { selectedPlant } = usePlant();

  const [logs, setLogs] = useState<DbLogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [selectedLog, setSelectedLog] = useState<DbLogRow | null>(null);

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  // Action legend filter (toggle). If empty => show all.
  const [activeActions, setActiveActions] = useState<ActionKey[]>([]);

  // Grouping mode
  const [groupMode, setGroupMode] = useState<GroupMode>("plain");

  // fixture_events state for the details modal
  const [fixtureEvents, setFixtureEvents] = useState<FixtureEventRow[] | null>(null);
  const [fixtureEventsLoading, setFixtureEventsLoading] = useState<boolean>(false);
  const [fixtureEventsError, setFixtureEventsError] = useState<string | null>(null);

  const userGroup = String((session?.user as any)?.user_group || "").trim().toLowerCase();
  const isAdmin = userGroup === "admin";

  const sessionPlant = String(
    (session?.user as any)?.fixture_plant || (session?.user as any)?.plant_name || ""
  ).trim();

  const plantForRequest = isAdmin
    ? String(selectedPlant || "").trim()
    : sessionPlant || String(selectedPlant || "").trim();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const payload: any = { action: "getLogs" };
        if (plantForRequest && plantForRequest !== "") {
          payload.fixture_plant = plantForRequest;
        }

        const res = await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (data.status !== 200) {
          setError(data.message || "Failed to load logs");
          setLogs([]);
        } else {
          setLogs(data.data || []);
        }
      } catch (err: any) {
        console.error("Error fetching logs:", err);
        setError("Error fetching logs");
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      if (!isAdmin && (!plantForRequest || plantForRequest.trim() === "")) {
        setLoading(false);
        setLogs([]);
        setError("Your account has no plant assigned (fixture_plant). Please contact an admin.");
        return;
      }
      fetchLogs();
    }
  }, [status, selectedPlant, sessionPlant, isAdmin, plantForRequest]);

  // Visible columns dynamically (hide entry_id)
  const columnKeys: string[] = useMemo(
    () =>
      logs.length > 0
        ? Object.keys(logs[0]).filter((k) => k.toLowerCase() !== "entry_id" && k !== "__row")
        : [],
    [logs]
  );

  const formatHeader = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Row class coding based on db_action (keeps your existing CSS colors)
  const getRowClassName = (row: DbLogRow): string => {
    const action = safeLower(row.db_action);

    if (action.startsWith("limit & warning updated")) return "logs-row-limit-change";
    if (action.startsWith("owner email updated")) return "logs-row-owner-change";
    if (action.startsWith("contacts updated")) return "logs-row-contacts-updated";
    if (action.startsWith("counter reset")) return "logs-row-counter-reset";

    // fallback
    if (action.includes("fail") || action.includes("error")) return "table-danger";
    if (action.includes("reset")) return "table-warning";
    if (action.includes("delete") || action.includes("remove")) return "table-danger";
    if (action.includes("update") || action.includes("edit") || action.includes("modify"))
      return "table-warning";
    if (action.includes("create") || action.includes("add") || action.includes("insert"))
      return "table-info";

    return "";
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  // Base filter: date + search (THIS is what legend counters should reflect)
  const baseFilteredLogs = useMemo(() => {
    const now = new Date();

    return logs.filter((log) => {
      const rawValue = log[TIMESTAMP_KEY];
      let dateOk = true;

      if (dateFilter !== "all" || customFrom || customTo) {
        if (!rawValue) {
          dateOk = false;
        } else {
          const dateVal = new Date(rawValue);
          if (isNaN(dateVal.getTime())) {
            dateOk = false;
          } else {
            if (dateFilter === "24h") {
              const limit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              dateOk = dateVal >= limit;
            } else if (dateFilter === "7d") {
              const limit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              dateOk = dateVal >= limit;
            } else if (dateFilter === "30d") {
              const limit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              dateOk = dateVal >= limit;
            } else if (dateFilter === "custom") {
              let fromDate: Date | null = null;
              let toDate: Date | null = null;

              if (customFrom) fromDate = new Date(customFrom);
              if (customTo) {
                const tmp = new Date(customTo);
                tmp.setHours(23, 59, 59, 999);
                toDate = tmp;
              }

              if (fromDate && dateVal < fromDate) dateOk = false;
              if (toDate && dateVal > toDate) dateOk = false;
            }
          }
        }
      }

      if (!dateOk) return false;

      if (!normalizedSearch) return true;

      return Object.entries(log).some(([key, value]) => {
        if (key.toLowerCase() === "entry_id") return false;
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(normalizedSearch);
      });
    });
  }, [logs, dateFilter, customFrom, customTo, normalizedSearch]);

  // Legend counters (do NOT change when clicking legend buttons)
  const legendCounts = useMemo(() => {
    const counts: Record<ActionKey, number> = {
      LIMIT_CHANGE: 0,
      OWNER_CHANGE: 0,
      CONTACTS_UPDATED: 0,
      COUNTER_RESET: 0,
      OTHER: 0,
    };
    baseFilteredLogs.forEach((row) => {
      const k = getActionKeyFromRow(row);
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [baseFilteredLogs]);

  // Apply legend filter (action type) on top of base filter
  const actionFilteredLogs = useMemo(() => {
    if (!activeActions.length) return baseFilteredLogs;
    const set = new Set(activeActions);
    return baseFilteredLogs.filter((row) => set.has(getActionKeyFromRow(row)));
  }, [baseFilteredLogs, activeActions]);

  // Sorting (applies to the action-filtered logs)
  const sortedLogs = useMemo(() => {
    if (!sortConfig) return actionFilteredLogs;

    const { key, direction } = sortConfig;
    const factor = direction === "asc" ? 1 : -1;

    return [...actionFilteredLogs].sort((a, b) => {
      const va = a[key];
      const vb = b[key];

      if (key === TIMESTAMP_KEY) {
        const da = va ? new Date(va).getTime() : 0;
        const db = vb ? new Date(vb).getTime() : 0;
        return (da - db) * factor;
      }

      const na = typeof va === "number" ? va : Number(va);
      const nb = typeof vb === "number" ? vb : Number(vb);

      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return (na - nb) * factor;
      }

      const sa = va ? String(va).toLowerCase() : "";
      const sb = vb ? String(vb).toLowerCase() : "";

      if (sa < sb) return -1 * factor;
      if (sa > sb) return 1 * factor;
      return 0;
    });
  }, [actionFilteredLogs, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const fetchFixtureEventsForRow = async (row: DbLogRow) => {
    setFixtureEventsLoading(true);
    setFixtureEventsError(null);
    setFixtureEvents(null);

    try {
      const payload = {
        action: "getLogDetails",
        adapter_code: row.adapter_code,
        fixture_type: row.fixture_type,
        fixture_plant: row.fixture_plant,
      };

      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status !== 200) {
        setFixtureEventsError(data.message || "Failed to load fixture events");
        setFixtureEvents([]);
      } else {
        setFixtureEvents(data.data || []);
      }
    } catch (err) {
      console.error("[LogsPage] Error fetching fixture events:", err);
      setFixtureEventsError("Error loading fixture events");
      setFixtureEvents([]);
    } finally {
      setFixtureEventsLoading(false);
    }
  };

  const handleRowClick = (row: DbLogRow) => {
    setSelectedLog(row);
    fetchFixtureEventsForRow(row);
  };

  const closeDetails = () => {
    setSelectedLog(null);
    setFixtureEvents(null);
    setFixtureEventsError(null);
    setFixtureEventsLoading(false);
  };

  const renderHeaderLabel = (key: string, label: string) => {
    const isSorted = sortConfig?.key === key;
    const direction = sortConfig?.direction;
    return (
      <span className="d-inline-flex align-items-center gap-1">
        {label}
        {isSorted && <span className="logs-sort-indicator">{direction === "asc" ? "▲" : "▼"}</span>}
      </span>
    );
  };

  const totalTableCols = useMemo(() => {
    let cols = 1; // index column
    columnKeys.forEach((k) => {
      cols += k === TIMESTAMP_KEY ? 2 : 1;
    });
    return cols;
  }, [columnKeys]);

  // Grouped view rows (in-table “header” rows)
  const groupedRows = useMemo(() => {
    if (groupMode === "plain") {
      return [{ type: "rows" as const, rows: sortedLogs }];
    }

    if (groupMode === "equipment") {
      // Group by plant + adapter + type (and show project name if present)
      const map = new Map<string, DbLogRow[]>();
      sortedLogs.forEach((r) => {
        const k = `${r.fixture_plant ?? ""}||${r.adapter_code ?? ""}||${r.fixture_type ?? ""}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(r);
      });

      // Sort groups by latest timestamp desc
      const groups = Array.from(map.entries()).sort((a, b) => {
        const at = a[1][0]?.[TIMESTAMP_KEY] ? new Date(a[1][0][TIMESTAMP_KEY]).getTime() : 0;
        const bt = b[1][0]?.[TIMESTAMP_KEY] ? new Date(b[1][0][TIMESTAMP_KEY]).getTime() : 0;
        return bt - at;
      });

      return groups.map(([k, rows]) => {
        const [plant, adapter, ftype] = k.split("||");
        const project = rows.find((x) => x.project_name)?.project_name;
        const title = `${plant} • ${adapter}/${ftype}${project ? ` • ${project}` : ""}`;
        return { type: "group" as const, title, rows };
      });
    }

    // day
    const dayMap = new Map<string, DbLogRow[]>();
    sortedLogs.forEach((r) => {
      const ts = r[TIMESTAMP_KEY] ? new Date(r[TIMESTAMP_KEY]) : null;
      const dayKey = ts && !isNaN(ts.getTime()) ? ts.toLocaleDateString() : "Unknown date";
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
      dayMap.get(dayKey)!.push(r);
    });

    const dayGroups = Array.from(dayMap.entries()).sort((a, b) => {
      // sort by actual date desc when possible
      const parse = (s: string) => {
        const d = new Date(s);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      return parse(b[0]) - parse(a[0]);
    });

    return dayGroups.map(([day, rows]) => ({
      type: "group" as const,
      title: `${day}`,
      rows,
    }));
  }, [sortedLogs, groupMode]);

  const toggleLegend = (key: ActionKey) => {
    setActiveActions((prev) => {
      const set = new Set(prev);
      if (set.has(key)) set.delete(key);
      else set.add(key);

      // If user selects ALL 4 main ones, treat as “all” (empty filter)
      const next = Array.from(set);
      const main = next.filter((k) => k !== "OTHER");
      if (main.length === 4 && !next.includes("OTHER")) return [];
      return next;
    });
  };

  const clearLegend = () => setActiveActions([]);

  const exportCsv = () => {
    // Export current table rows (after search/date + legend filters), without group header rows
    const filenamePlant = plantForRequest ? `_${plantForRequest}` : "";
    const filename = `db_logs${filenamePlant}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    const csv = buildCsv(sortedLogs, columnKeys, TIMESTAMP_KEY);
    downloadTextFile(filename, csv, "text/csv;charset=utf-8;");
  };

  if (status === "loading") {
    return (
      <>
        <Head>
          <title>Loading logs...</title>
        </Head>
        <div className="d-flex flex-column align-items-center justify-content-center screen-100 paddingTopBottom">
          <div className="d-flex justify-content-center">
            <div className="spinner-grow text-primary" style={{ width: "5rem", height: "5rem" }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
          <div className="d-flex justify-content-center p-4">
            <p className="text-white h3">Loading logs...</p>
          </div>
        </div>
      </>
    );
  }

  if (status === "unauthenticated") return null;

  const selectedActionKey = selectedLog ? getActionKeyFromRow(selectedLog) : "OTHER";
  const selectedActionDef = getActionDef(selectedActionKey);

  return (
    <>
      <Head>
        <title>Logs | AUMOVIO</title>
      </Head>

      {/* local styles for “full color” legend + hover scale */}
      <style jsx>{`
        .logs-topbar {
          gap: 10px;
        }

        .legend-btn {
          border: 0;
          border-radius: 12px;
          padding: 10px 12px;
          min-width: 190px;
          text-align: left;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
          transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
        }

        .legend-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
        }

        .legend-btn.active {
          outline: 3px solid rgba(255, 255, 255, 0.55);
          outline-offset: -3px;
          filter: saturate(1.15);
        }

        .legend-title {
          font-weight: 700;
          letter-spacing: 0.2px;
          font-size: 0.95rem;
          line-height: 1.1;
        }

        .legend-sub {
          opacity: 0.95;
          font-size: 0.85rem;
          margin-top: 4px;
        }

        .group-btn {
          border-radius: 12px;
          padding: 5px 14px;
          border: 0;
          background: #2f2f2f;
          color: #fff;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
          transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
          white-space: nowrap;
        }

        .group-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
          background: #3a3a3a;
        }

        .group-btn.active {
          background: #111111;
          outline: 3px solid rgba(255, 255, 255, 0.35);
          outline-offset: -3px;
        }

        .export-btn {
          border-radius: 12px;
          padding: 10px 14px;
          border: 0;
          background: #ff4c00;
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
          transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
          white-space: nowrap;
        }

        .export-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
          filter: saturate(1.1);
        }

        .logs-group-row td {
          padding: 10px 12px !important;
          background: #f6f7f9 !important;
          font-weight: 700;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .logs-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .logs-pill-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          display: inline-block;
        }
      `}</style>

      <div className="container-fluid paddingTopBottomLog px-4">
        {/* Filters */}
        <div className="card mb-2 shadow-sm border-0">
          <div className="card-body logs-filters d-flex flex-column flex-lg-row gap-3">
            <div className="flex-grow-1">
              <label className="fw-semibold mb-1">Search</label>
              <input
                type="text"
                className="form-control"
                placeholder="Filter by any column (project, adapter, action, user, etc.)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="logs-date-filter">
              <label className="fw-semibold mb-1">Date range</label>
              <div className="d-flex flex-column gap-2">
                <select className="form-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
                  <option value="all">All</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>

                {dateFilter === "custom" && (
                  <div className="d-flex flex-column flex-sm-row gap-2">
                    <input type="date" className="form-control" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                    <input type="date" className="form-control" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Top buttons: legend + grouping + export */}
        <div className="d-flex flex-column gap-2 mb-2">
          <div className="d-flex flex-wrap logs-topbar">
            {ACTION_DEFS.filter((d) => d.key !== "OTHER").map((def) => {
              const isActive = activeActions.includes(def.key);
              const count = legendCounts[def.key] ?? 0;

              return (
                <button
                  key={def.key}
                  type="button"
                  className={`legend-btn ${isActive ? "active" : ""}`}
                  style={{ background: def.btnBg, color: def.btnText }}
                  onClick={() => toggleLegend(def.key)}
                  title="Click to filter (toggle)"
                >
                  <div className="legend-title">{def.label}</div>
                  <div className="legend-sub">
                    Rows: <strong>{count}</strong>
                  </div>
                </button>
              );
            })}

            <button type="button" className="legend-btn" style={{ background: "#343a40", color: "#fff", minWidth: 140 }} onClick={clearLegend}>
              <div className="legend-title">All actions</div>
              <div className="legend-sub">
                Rows: <strong>{baseFilteredLogs.length}</strong>
              </div>
            </button>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className={`group-btn ${groupMode === "plain" ? "active" : ""}`} onClick={() => setGroupMode("plain")}>
                All
              </button>
              <button type="button" className={`group-btn ${groupMode === "equipment" ? "active" : ""}`} onClick={() => setGroupMode("equipment")}>
                Group by equipment
              </button>
              <button type="button" className={`group-btn ${groupMode === "day" ? "active" : ""}`} onClick={() => setGroupMode("day")}>
                Group by day
              </button>
            </div>

            <div className="ms-auto d-flex gap-2">
              <button type="button" className="export-btn" onClick={exportCsv} disabled={sortedLogs.length === 0}>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Logs table */}
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h5 className="card-title mb-1">Logs history</h5>

            {loading && <p>Loading logs...</p>}
            {error && <p className="text-danger">{error}</p>}

            {!loading && !error && sortedLogs.length === 0 && <p>No log entries found for the current filters.</p>}

            {!loading && !error && sortedLogs.length > 0 && (
              <div className="table-responsive logs-table-wrapper logs-table-scroll">
                <table className="table table-sm table-striped table-hover align-middle logs-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60px" }}></th>
                      {columnKeys.map((key) => {
                        if (key === TIMESTAMP_KEY) {
                          return (
                            <React.Fragment key={key}>
                              <th className="logs-header-sortable" onClick={() => handleSort(TIMESTAMP_KEY)}>
                                {renderHeaderLabel(TIMESTAMP_KEY, "Date")}
                              </th>
                              <th className="logs-header-sortable" onClick={() => handleSort(TIMESTAMP_KEY)}>
                                {renderHeaderLabel(TIMESTAMP_KEY, "Time")}
                              </th>
                            </React.Fragment>
                          );
                        }

                        return (
                          <th key={key} className="logs-header-sortable" onClick={() => handleSort(key)}>
                            {renderHeaderLabel(key, formatHeader(key))}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {groupedRows.map((block, bIdx) => {
                      if (block.type === "rows") {
                        return block.rows.map((row, idx) => {
                          const rowClass = getRowClassName(row);
                          const tsRaw = row[TIMESTAMP_KEY];
                          const tsDate =
                            tsRaw && !isNaN(new Date(tsRaw).getTime()) ? new Date(tsRaw) : null;

                          return (
                            <tr
                              key={row.entry_id ?? `${bIdx}-${idx}`}
                              className={`${rowClass} logs-row-clickable`}
                              onClick={() => handleRowClick(row)}
                            >
                              <td>{idx + 1}</td>

                              {columnKeys.map((key) => {
                                if (key === TIMESTAMP_KEY) {
                                  return (
                                    <React.Fragment key={key}>
                                      <td>{tsDate ? tsDate.toLocaleDateString() : ""}</td>
                                      <td>
                                        {tsDate
                                          ? tsDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                          : ""}
                                      </td>
                                    </React.Fragment>
                                  );
                                }

                                const value =
                                  row[key] !== null && row[key] !== undefined ? String(row[key]) : "";
                                return <td key={key}>{value}</td>;
                              })}
                            </tr>
                          );
                        });
                      }

                      // group header + rows
                      const startIndex = 0;
                      return (
                        <React.Fragment key={`group-${bIdx}`}>
                          <tr className="logs-group-row">
                            <td colSpan={totalTableCols}>
                              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                <div>{block.title}</div>
                                <div className="text-muted" style={{ fontWeight: 600 }}>
                                  Rows: {block.rows.length}
                                </div>
                              </div>
                            </td>
                          </tr>

                          {block.rows.map((row, idx) => {
                            const rowClass = getRowClassName(row);
                            const tsRaw = row[TIMESTAMP_KEY];
                            const tsDate =
                              tsRaw && !isNaN(new Date(tsRaw).getTime()) ? new Date(tsRaw) : null;

                            return (
                              <tr
                                key={row.entry_id ?? `${bIdx}-${idx}`}
                                className={`${rowClass} logs-row-clickable`}
                                onClick={() => handleRowClick(row)}
                              >
                                <td>{startIndex + idx + 1}</td>

                                {columnKeys.map((key) => {
                                  if (key === TIMESTAMP_KEY) {
                                    return (
                                      <React.Fragment key={key}>
                                        <td>{tsDate ? tsDate.toLocaleDateString() : ""}</td>
                                        <td>
                                          {tsDate
                                            ? tsDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                            : ""}
                                        </td>
                                      </React.Fragment>
                                    );
                                  }

                                  const value =
                                    row[key] !== null && row[key] !== undefined ? String(row[key]) : "";
                                  return <td key={key}>{value}</td>;
                                })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Details modal */}
        {selectedLog && (
          <div className="logs-modal-backdrop" onClick={closeDetails}>
            <div className="logs-modal card shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="d-flex flex-column gap-2">
                    <h5 className="mb-0">Log details</h5>

                    {/* “Legend” inside modal, matching row colors */}
                    <div
                      className="logs-pill"
                      style={{
                        background: selectedActionDef.pillBg,
                        color: selectedActionDef.pillText,
                      }}
                    >
                      <span
                        className="logs-pill-dot"
                        style={{ background: selectedActionDef.btnBg }}
                      />
                      <span>{selectedActionDef.label}</span>
                    </div>
                  </div>

                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeDetails}>
                    Close
                  </button>
                </div>

                {/* Base db_logs details */}
                <div className="logs-details mb-3">
                  <dl>
                    {columnKeys.map((key) => {
                      const value =
                        selectedLog[key] !== null && selectedLog[key] !== undefined ? String(selectedLog[key]) : "";

                      // Make db_action value itself “colored”, acting as legend
                      if (key === "db_action") {
                        const k = getActionKeyFromRow(selectedLog);
                        const def = getActionDef(k);
                        return (
                          <div className="d-flex flex-column flex-md-row logs-detail-row" key={key}>
                            <dt className="logs-detail-key">{formatHeader(key)}</dt>
                            <dd className="logs-detail-value">
                              <span
                                className="logs-pill"
                                style={{
                                  background: def.pillBg,
                                  color: def.pillText,
                                }}
                              >
                                <span className="logs-pill-dot" style={{ background: def.btnBg }} />
                                <span>{value}</span>
                              </span>
                            </dd>
                          </div>
                        );
                      }

                      return (
                        <div className="d-flex flex-column flex-md-row logs-detail-row" key={key}>
                          <dt className="logs-detail-key">{formatHeader(key)}</dt>
                          <dd className="logs-detail-value">{value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>

                {/* Extra analytics from fixture_events */}
                <hr className="my-3" />
                <h6 className="mb-2">Related fixture events</h6>

                {fixtureEventsLoading && <p className="small text-muted mb-2">Loading related events...</p>}

                {fixtureEventsError && <p className="small text-danger mb-2">{fixtureEventsError}</p>}

                {!fixtureEventsLoading && !fixtureEventsError && fixtureEvents && fixtureEvents.length === 0 && (
                  <p className="small text-muted mb-0">No additional fixture events found for this equipment.</p>
                )}

                {!fixtureEventsLoading && !fixtureEventsError && fixtureEvents && fixtureEvents.length > 0 && (
                  <div className="logs-fixture-events">
                    {fixtureEvents.map((ev, idx) => {
                      const created =
                        ev.created_at && !isNaN(new Date(ev.created_at).getTime()) ? new Date(ev.created_at) : null;

                      return (
                        <div key={ev.entry_id ?? idx} className="logs-fixture-event border rounded p-2 mb-2">
                          <div className="d-flex justify-content-between small text-muted">
                            <span>{ev.event_type}</span>
                            <span>
                              {created
                                ? created.toLocaleString([], {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                          </div>

                          {ev.event_details && (
                            <div className="small mt-1">
                              <strong>Details:</strong> {String(ev.event_details)}
                            </div>
                          )}

                          {(ev.old_value || ev.new_value) && (
                            <div className="small mt-1">
                              {ev.old_value && (
                                <div>
                                  <strong>Old:</strong> {String(ev.old_value)}
                                </div>
                              )}
                              {ev.new_value && (
                                <div>
                                  <strong>New:</strong> {String(ev.new_value)}
                                </div>
                              )}
                            </div>
                          )}

                          {ev.actor && (
                            <div className="small mt-1">
                              <strong>Change responsible:</strong> {String(ev.actor)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LogsPage;

LogsPage.getLayout = function getLayout(page: any) {
  return <Layout>{page}</Layout>;
};
