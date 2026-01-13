// pages/updatecontacts.tsx
import Head from "next/head";
import Layout from "../components/layout";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useRef, useState } from "react";

const UpdateContactsPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [adapterCode, setAdapterCode] = useState("");
  const [fixtureType, setFixtureType] = useState("");
  const [contacts, setContacts] = useState<string>("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Admin check
  const isAdmin =
    status === "authenticated" &&
    String((session as any)?.user?.user_group || "").toLowerCase() === "admin";

  // =========================
  //  PLANT DROPDOWN (like AddTestProbes)
  // =========================
  const [plants, setPlants] = useState<string[]>([]);
  const [fixturePlant, setFixturePlant] = useState<string>("");
  const [plantSearch, setPlantSearch] = useState<string>("");
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const plantDropdownRef = useRef<HTMLDivElement | null>(null);

  // Redirect unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  // Load plants from API (same endpoint & style as AddTestProbes)
  useEffect(() => {
    if (!isAdmin) return;

    fetch("/api/getPlants")
      .then((r) => r.json())
      .then((arr) => {
        const list = Array.isArray(arr)
          ? arr.map((p: any) => p.plant_name).filter(Boolean)
          : [];
        setPlants(list);

        // If user has a plant in session and it's in the list, preselect it
        const sessionPlant = (session as any)?.user?.fixture_plant;
        if (sessionPlant && list.includes(String(sessionPlant))) {
          setFixturePlant(String(sessionPlant));
        }
      })
      .catch(() => {
        // ignore; if plants fail to load, user will just see empty dropdown
      });
  }, [isAdmin, session]);

  // Keep the search box aligned with selected plant
  useEffect(() => {
    setPlantSearch(fixturePlant || "");
  }, [fixturePlant]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        plantDropdownRef.current &&
        !plantDropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const filteredPlants = plants.filter((p) =>
    p.toLowerCase().includes(plantSearch.toLowerCase())
  );

  // =========================
  //  Submit handler
  // =========================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const numericContacts = Number(contacts);
    if (!Number.isFinite(numericContacts) || numericContacts < 0) {
      setFeedback({ type: "error", message: "Contacts must be a non-negative number." });
      return;
    }

    if (!adapterCode.trim() || !fixtureType.trim()) {
      setFeedback({
        type: "error",
        message: "Please fill in adapter code and fixture type.",
      });
      return;
    }

    if (!fixturePlant.trim()) {
      setFeedback({
        type: "error",
        message: "Please select a fixture plant location.",
      });
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/updateContacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapter_code: adapterCode.trim(),
          fixture_type: fixtureType.trim(),
          fixture_plant: fixturePlant.trim(),
          contacts: numericContacts,
        }),
      });

      const data = await res.json();

      if (res.ok && data.status === 200) {
        setFeedback({
          type: "success",
          message: data.message || "Contacts updated successfully.",
        });
      } else {
        setFeedback({
          type: "error",
          message: data.message || "Failed to update contacts.",
        });
      }
    } catch (err: any) {
      console.error("Update contacts error:", err);
      setFeedback({
        type: "error",
        message: err.message || "Unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  // =========================
  //  RENDERING
  // =========================

  // Loading state while session is determined
  if (status === "loading") {
    return (
      <>
        <Head>
          <title>Loading...</title>
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
            <p className="text-white h3">Loading data...</p>
          </div>
        </div>
      </>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <>
        <Head>
          <title>Update contacts</title>
        </Head>
        <div className="d-flex flex-column align-items-center justify-content-center screen-100 paddingTopBottom">
          <p className="text-white h3">You are not allowed to access this section!</p>
        </div>
      </>
    );
  }

  // Admin view
  return (
    <>
      <Head>
        <title>Update contacts | AUMOVIO</title>
      </Head>

      <div className="container-fluid paddingTopBottom px-4">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8 col-xl-6">
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h4 className="card-title mb-3 text-center">Update contacts for equipment</h4>
                <p className="text-muted text-center mb-4">
                  Admin-only tool to manually set the contacts value of an equipment.{" "}
                  All changes are logged in <strong>db_logs</strong>.
                </p>

                {feedback && (
                  <div
                    className={`alert ${
                      feedback.type === "success" ? "alert-success" : "alert-danger"
                    }`}
                    role="alert"
                  >
                    {feedback.message}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                  <div>
                    <label className="form-label fw-semibold">Adapter code</label>
                    <input
                      type="text"
                      className="form-control fw-bolder"
                      value={adapterCode}
                      onChange={(e) => setAdapterCode(e.target.value)}
                      placeholder="e.g. 113"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Fixture type</label>
                    <input
                      type="text"
                      className="form-control fw-bolder"
                      value={fixtureType}
                      onChange={(e) => setFixtureType(e.target.value)}
                      placeholder="e.g. FCT / ICT"
                      required
                    />
                  </div>

                  {/* Admin-only plant combobox (same style as AddTestProbes) */}
                  <div
                    className="dropdown w-100 mb-2"
                    ref={plantDropdownRef}
                    style={{ position: "relative" }}
                  >
                    <label className="form-label fw-semibold">Fixture plant location</label>
                    <input
                      type="text"
                      className="form-control fw-bolder dropdown-toggle"
                      id="plantDropdown"
                      placeholder="Fixture plant location"
                      value={plantSearch}
                      onFocus={() => setDropdownOpen(true)}
                      onClick={() => setDropdownOpen(true)}
                      onChange={(e) => {
                        setPlantSearch(e.target.value);
                        setDropdownOpen(true);
                      }}
                      autoComplete="off"
                    />

                    {isDropdownOpen && (
                      <ul
                        className="dropdown-menu custom-dropdown w-100 show"
                        aria-labelledby="plantDropdown"
                        style={{ maxHeight: "200px", overflowY: "auto", zIndex: 2000 }}
                      >
                        <li>
                          <button
                            type="button"
                            className="dropdown-item text-danger"
                            onClick={() => {
                              setFixturePlant("");
                              setPlantSearch("");
                              setDropdownOpen(false);
                            }}
                          >
                            Clear Selection
                          </button>
                        </li>
                        <li>
                          <hr className="dropdown-divider" />
                        </li>

                        {filteredPlants.length === 0 && (
                          <li className="dropdown-item disabled text-muted">
                            No plants found
                          </li>
                        )}

                        {filteredPlants.map((p, idx) => (
                          <li key={idx}>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setFixturePlant(p);
                                setDropdownOpen(false);
                              }}
                            >
                              {p}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label className="form-label fw-semibold">New contacts value</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control fw-bolder"
                      value={contacts}
                      onChange={(e) => setContacts(e.target.value)}
                      placeholder="e.g. 12345"
                      required
                    />
                  </div>

                  <div className="d-flex justify-content-center mt-3">
                    <button
                      type="submit"
                      className="btn btn-primary fs-5 fw-bold px-4 scaleEffect"
                      disabled={loading}
                    >
                      {loading ? "Updating..." : "Update contacts"}
                    </button>
                  </div>
                </form>

                <div className="text-center mt-3">
                  <small className="text-muted">
                    Tip: After updating, verify the value in the equipment list and{" "}
                    <strong>Logs</strong> page.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UpdateContactsPage;

UpdateContactsPage.getLayout = function getLayout(page: any) {
  return <Layout>{page}</Layout>;
};
