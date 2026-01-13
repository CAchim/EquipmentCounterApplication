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

// 🔧 Our datetime column in db_logs
const TIMESTAMP_KEY = "last_update";

type DateFilter = "all" | "24h" | "7d" | "30d" | "custom";

const LogsPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { selectedPlant } = usePlant(); // 🔹 plant from navbar context

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

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  // Fetch logs when authenticated or when admin changes plant
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        // 🔹 Build payload, include plant only if selected
        const payload: any = { action: "getLogs" };
        if (selectedPlant && selectedPlant.trim() !== "") {
          payload.fixture_plant = selectedPlant.trim();
        }

        const res = await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (data.status !== 200) {
          setError(data.message || "Failed to load logs");
        } else {
          setLogs(data.data || []);
        }
      } catch (err: any) {
        console.error("Error fetching logs:", err);
        setError("Error fetching logs");
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchLogs();
    }
  }, [status, selectedPlant]); // 🔹 refetch when plant changes

  // Determine visible columns dynamically (hide entry_id)
  const columnKeys: string[] = useMemo(
    () =>
      logs.length > 0
        ? Object.keys(logs[0]).filter(
            (k) => k.toLowerCase() !== "entry_id" && k !== "__row"
          )
        : [],
    [logs]
  );

  const formatHeader = (key: string) =>
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // Row color coding based on db_action
  const getRowClassName = (row: DbLogRow): string => {
    const action = String(row.db_action || "").toLowerCase();

    if (action.includes("fail") || action.includes("error")) {
      return "table-danger";
    }
    if (action.includes("reset")) {
      return "table-warning";
    }
    if (action.includes("delete") || action.includes("remove")) {
      return "table-danger";
    }
    if (
      action.includes("update") ||
      action.includes("edit") ||
      action.includes("modify")
    ) {
      return "table-warning";
    }
    if (
      action.includes("create") ||
      action.includes("add") ||
      action.includes("insert")
    ) {
      return "table-info";
    }

    return "";
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  // Filter logs (search + date range)
  const filteredLogs = useMemo(() => {
    const now = new Date();

    return logs.filter((log) => {
      // Date filter
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

              if (customFrom) {
                fromDate = new Date(customFrom);
              }
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

      // Search filter
      if (!normalizedSearch) return true;

      return Object.entries(log).some(([key, value]) => {
        if (key.toLowerCase() === "entry_id") return false;
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(normalizedSearch);
      });
    });
  }, [logs, dateFilter, customFrom, customTo, normalizedSearch]);

  // Sorting
  const sortedLogs = useMemo(() => {
    if (!sortConfig) return filteredLogs;

    const { key, direction } = sortConfig;
    const factor = direction === "asc" ? 1 : -1;

    return [...filteredLogs].sort((a, b) => {
      const va = a[key];
      const vb = b[key];

      // Special handling for datetime
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
  }, [filteredLogs, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const handleRowClick = (row: DbLogRow) => {
    setSelectedLog(row);
  };

  const closeDetails = () => setSelectedLog(null);

  const renderHeaderLabel = (key: string, label: string) => {
    const isSorted = sortConfig?.key === key;
    const direction = sortConfig?.direction;
    return (
      <span className="d-inline-flex align-items-center gap-1">
        {label}
        {isSorted && (
          <span className="logs-sort-indicator">
            {direction === "asc" ? "▲" : "▼"}
          </span>
        )}
      </span>
    );
  };

  // 🔽 Rendering (no hooks below this point)

  if (status === "loading") {
    return (
      <>
        <Head>
          <title>Loading logs...</title>
        </Head>
        <div className="d-flex flex-column align-items-center justify-content-center screen-100 paddingTopBottom">
          <div className="d-flex justify-content-center">
            <div
              className="spinner-grow text-primary"
              style={{ width: "5rem", height: "5rem" }}
              role="status"
            >
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

  if (status === "unauthenticated") {
    // redirect is already triggered in useEffect
    return null;
  }

  return (
    <>
      <Head>
        <title>Logs | AUMOVIO</title>
      </Head>

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
                <select
                  className="form-select"
                  value={dateFilter}
                  onChange={(e) =>
                    setDateFilter(e.target.value as DateFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>

                {dateFilter === "custom" && (
                  <div className="d-flex flex-column flex-sm-row gap-2">
                    <input
                      type="date"
                      className="form-control"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                    <input
                      type="date"
                      className="form-control"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Logs table */}
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h5 className="card-title mb-1">Logs history</h5>

            {loading && <p>Loading logs...</p>}
            {error && <p className="text-danger">{error}</p>}

            {!loading && !error && sortedLogs.length === 0 && (
              <p>No log entries found for the current filters.</p>
            )}

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
                              <th
                                className="logs-header-sortable"
                                onClick={() => handleSort(TIMESTAMP_KEY)}
                              >
                                {renderHeaderLabel(TIMESTAMP_KEY, "Date")}
                              </th>
                              <th
                                className="logs-header-sortable"
                                onClick={() => handleSort(TIMESTAMP_KEY)}
                              >
                                {renderHeaderLabel(TIMESTAMP_KEY, "Time")}
                              </th>
                            </React.Fragment>
                          );
                        }

                        return (
                          <th
                            key={key}
                            className="logs-header-sortable"
                            onClick={() => handleSort(key)}
                          >
                            {renderHeaderLabel(key, formatHeader(key))}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLogs.map((row, idx) => {
                      const rowClass = getRowClassName(row);
                      const tsRaw = row[TIMESTAMP_KEY];
                      const tsDate =
                        tsRaw && !isNaN(new Date(tsRaw).getTime())
                          ? new Date(tsRaw)
                          : null;

                      return (
                        <tr
                          key={row.entry_id ?? idx}
                          className={`${rowClass} logs-row-clickable`}
                          onClick={() => handleRowClick(row)}
                        >
                          <td>{idx + 1}</td>
                          {columnKeys.map((key) => {
                            if (key === TIMESTAMP_KEY) {
                              return (
                                <React.Fragment key={key}>
                                  <td>
                                    {tsDate
                                      ? tsDate.toLocaleDateString()
                                      : ""}
                                  </td>
                                  <td>
                                    {tsDate
                                      ? tsDate.toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : ""}
                                  </td>
                                </React.Fragment>
                              );
                            }

                            const value =
                              row[key] !== null && row[key] !== undefined
                                ? String(row[key])
                                : "";

                            return <td key={key}>{value}</td>;
                          })}
                        </tr>
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
            <div
              className="logs-modal card shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Log details</h5>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={closeDetails}
                  >
                    Close
                  </button>
                </div>

                <div className="logs-details">
                  <dl>
                    {columnKeys.map((key) => (
                      <div
                        className="d-flex flex-column flex-md-row logs-detail-row"
                        key={key}
                      >
                        <dt className="logs-detail-key">
                          {formatHeader(key)}
                        </dt>
                        <dd className="logs-detail-value">
                          {selectedLog[key] !== null &&
                          selectedLog[key] !== undefined
                            ? String(selectedLog[key])
                            : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
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
