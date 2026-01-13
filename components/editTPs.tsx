import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Tooltip } from "react-tooltip";

interface TestProbe {
  name: string;
  quantity: number;
  isEditing?: boolean;
  originalName?: string;
}

const EditTPs = (props: any) => {
  const [testProbes, setTestProbes] = useState<TestProbe[]>([]);
  const [showProbes, setShowProbes] = useState(false);

  const { data: session } = useSession();
  const isMounted = useRef(false);

  const adapterCodeRef = useRef<HTMLInputElement>(null);
  const fixtureTypeRef = useRef<HTMLInputElement>(null);

  const isAdmin = session?.user?.user_group === "admin";

  // Admin plant dropdown state
  const [plants, setPlants] = useState<string[]>([]);
  const [fixturePlant, setFixturePlant] = useState<string>("");
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [plantSearch, setPlantSearch] = useState<string>("");

  // Ref for click-outside on plant dropdown
  const plantDropdownRef = useRef<HTMLDivElement | null>(null);

  // Load plants for admin (same style as AddNewProject)
  useEffect(() => {
    if (isAdmin) {
      fetch("/api/getPlants")
        .then((r) => r.json())
        .then((arr) => {
          const list = Array.isArray(arr)
            ? arr.map((p: any) => p.plant_name).filter(Boolean)
            : [];
          setPlants(list);
        })
        .catch(() => {
          // ignore, errors will show up in API usage later if needed
        });
    }
  }, [isAdmin]);

  // Keep the search box in sync with the selected plant
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

  const requirePlantIfAdmin = (): boolean => {
    if (isAdmin && !fixturePlant.trim()) {
      props.openModalAction({
        title: "Error!",
        description: "Please select a Fixture plant location first.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return false;
    }
    return true;
  };

  const fetchTestProbes = async () => {
    const adapter_code = adapterCodeRef.current?.value.trim();
    const fixture_type = fixtureTypeRef.current?.value.trim();

    if (!adapter_code || !fixture_type) {
      alert("Please enter both Adapter Code and Fixture Type.");
      return;
    }

    if (!requirePlantIfAdmin()) return;

    const res = await fetch("/api/getTestProbes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adapter_code,
        fixture_type,
        fixture_plant: fixturePlant.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      const probes = data.testProbes.map((probe: any) => ({
        name: probe.name,
        quantity: probe.quantity,
        isEditing: false,
        originalName: probe.name,
      }));
      setTestProbes(probes);
      setShowProbes(true);
    } else {
      props.openModalAction({
        title: "Error!",
        description: data.message || "Could not fetch test probes.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      setShowProbes(false);
    }
  };

  const toggleEdit = (index: number) => {
    setTestProbes((prev) =>
      prev.map((probe, i) =>
        i === index ? { ...probe, isEditing: !probe.isEditing } : probe
      )
    );
  };

  const updateField = (
    index: number,
    field: keyof TestProbe,
    value: string | number
  ) => {
    setTestProbes((prev) =>
      prev.map((probe, i) =>
        i === index ? { ...probe, [field]: value } : probe
      )
    );
  };

  const saveChanges = async (index: number) => {
    const adapter_code = adapterCodeRef.current?.value.trim();
    const fixture_type = fixtureTypeRef.current?.value.trim();

    const probe = testProbes[index];
    const originalName = probe.originalName || probe.name;
    const newName = probe.name;
    const newQty = probe.quantity;

    if (!adapter_code || !fixture_type) {
      alert("Please fill in both Adapter Code and Fixture Type.");
      return;
    }

    if (!requirePlantIfAdmin()) return;

    if (!newName || isNaN(newQty)) {
      alert("Part number and quantity must be valid.");
      return;
    }

    const res = await fetch("/api/updateTestProbe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adapter_code,
        fixture_type,
        original_name: originalName,
        new_name: newName,
        new_quantity: newQty,
        fixture_plant: fixturePlant.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      props.openModalAction({
        title: "Error!",
        description: data.message || "Failed to update test probe.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return;
    }

    const updatedProbes = data.testProbes.map((probe: any) => ({
      name: probe.part_number,
      quantity: probe.quantity,
      isEditing: false,
      originalName: probe.part_number,
    }));

    setTestProbes(updatedProbes);
    props.openModalAction({
      title: "Success!",
      description: `"${probe.originalName}" was updated successfully.`,
      pictureUrl: "/confirm_OK.svg",
      className: "text-center",
    });
  };

  const confirmAndDelete = async (probeToRemove: string) => {
    if (
      !confirm(
        `Are you sure you want to delete test probe "${probeToRemove}" from the list?`
      )
    )
      return;

    const adapter_code = adapterCodeRef.current?.value.trim();
    const fixture_type = fixtureTypeRef.current?.value.trim();

    if (!adapter_code || !fixture_type) {
      alert("Please enter both Adapter Code and Fixture Type.");
      return;
    }

    if (!requirePlantIfAdmin()) return;

    const res = await fetch("/api/removeOneTP", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adapter_code,
        fixture_type,
        testProbeToRemove: probeToRemove,
        fixture_plant: fixturePlant.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      const probes = data.testProbes.map((probe: any) => ({
        name: probe.part_number,
        quantity: probe.quantity,
        isEditing: false,
        originalName: probe.part_number,
      }));
      setTestProbes(probes);

      props.openModalAction({
        title: "Success!",
        description: `Test probe "${probeToRemove}" was removed successfully from the list.`,
        pictureUrl: "/confirm_OK.svg",
        className: "text-center",
      });
    } else {
      props.openModalAction({
        title: "Error!",
        description: data.message || "Failed to remove test probe.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
    }
  };

  // 🔧 FIXED: always pass strings to modal on Remove All
  const handleRemoveAll = async (e: any) => {
    e.preventDefault();

    const user = String(session?.user?.email || session?.user?.name);
    const adapter_code = adapterCodeRef.current?.value.trim();
    const fixture_type = fixtureTypeRef.current?.value.trim();

    if (!adapter_code || !fixture_type) {
      alert("Please enter both Adapter Code and Fixture Type.");
      return;
    }

    if (!requirePlantIfAdmin()) return;

    try {
      const res = await fetch("/api/removeAllTPs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapter_code,
          fixture_type,
          fixture_plant: fixturePlant.trim() || undefined,
          modified_by: user,
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        const errorDescription =
          typeof data?.message === "string"
            ? data.message
            : typeof data?.sqlMessage === "string"
            ? data.sqlMessage
            : "Could not remove all test probes.";

        props.openModalAction({
          title: "Error!",
          description: errorDescription,
          pictureUrl: "/undraw_cancel_u-1-it.svg",
          className: "text-center",
        });
        return;
      }

      // success path
      setTestProbes([]);
      setShowProbes(false);

      const successDescription =
        typeof data?.message === "string"
          ? data.message
          : "All test probes removed for this equipment.";

      props.openModalAction({
        title: "Success!",
        description: successDescription,
        pictureUrl: "/confirm_OK.svg",
        className: "text-center",
      });
    } catch (err) {
      console.error("Error calling /api/removeAllTPs:", err);
      props.openModalAction({
        title: "Error!",
        description:
          "Request failed while trying to remove all test probes. Please try again.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <>
      <div className="container text-center createProjectBarWidth">
        <form
          className="d-flex flex-column justify-content-center align-items-center"
          method="post"
          onSubmit={handleRemoveAll}
        >
          <div className="input-section">
            <input
              ref={adapterCodeRef}
              name="adapter_code"
              type="text"
              className="form-control input-fields fw-bolder col"
              placeholder="Adapter code"
              required
            />
            <input
              ref={fixtureTypeRef}
              name="fixture_type"
              type="text"
              className="form-control input-fields fw-bolder col"
              placeholder="Fixture type"
              required
            />

            {/* Admin-only plant combobox (search + display in same box) */}
            {isAdmin && (
              <div
                className="dropdown dropup w-100 mb-3"
                ref={plantDropdownRef}
              >
                <input
                  type="text"
                  className="form-control input-fields fw-bolder col dropdown-toggle"
                  id="plantDropdown"
                  placeholder="Fixture plant location"
                  value={plantSearch}
                  onFocus={() => setDropdownOpen(true)}
                  onClick={() => setDropdownOpen(true)} // only open, no toggle
                  onChange={(e) => {
                    setPlantSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  autoComplete="off"
                />

                {isDropdownOpen && (
                  <ul
                    className="dropdown-menu custom-dropdown w-100 plant-dropdown show"
                    aria-labelledby="plantDropdown"
                    style={{ maxHeight: "190px", overflowY: "auto" }}
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
            )}
          </div>
          <button
            type="button"
            onClick={fetchTestProbes}
            className="btn btn-secondary fs-4 fw-bold text-nowrap col scaleEffect"
          >
            Show Test Probes
          </button>
        </form>
      </div>

      {showProbes && testProbes.length > 0 && (
        <div className="container mt-2">
          <ul className="list-group test-probe-list mx-auto">
            {testProbes.map((probe, idx) => (
              <li
                key={idx}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div className="flex-grow-1 me-2">
                  {probe.isEditing ? (
                    <>
                      <input
                        type="text"
                        value={probe.name}
                        onChange={(e) => updateField(idx, "name", e.target.value)}
                        className="form-control input-fields mb-1"
                        placeholder="Part Number"
                      />
                      <input
                        type="number"
                        value={probe.quantity}
                        onChange={(e) =>
                          updateField(idx, "quantity", parseInt(e.target.value, 10))
                        }
                        className="form-control input-fields"
                        placeholder="Quantity"
                      />
                    </>
                  ) : (
                    <div className="test-probe-text fw-bold">
                      <strong>PN:</strong> {probe.name} <br />
                      <strong>Qty:</strong> {probe.quantity}
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2 align-items-center">
                  {probe.isEditing ? (
                    <button
                      onClick={() => saveChanges(idx)}
                      className="btn btn-success btn-sm border-0"
                      data-tooltip-id="tp-tooltip"
                      data-tooltip-content="Save changes"
                    >
                      <Image src="/save.svg" alt="Save" width={20} height={20} />
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleEdit(idx)}
                      className="btn btn-edit btn-sm border-0"
                      data-tooltip-id="tp-tooltip"
                      data-tooltip-content="Edit Test Probe"
                    >
                      <Image src="/edit.svg" alt="Edit" width={20} height={20} />
                    </button>
                  )}
                  <button
                    onClick={() => confirmAndDelete(probe.name)}
                    className="btn btn-primary btn-sm border-0"
                    data-tooltip-id="tp-tooltip"
                    data-tooltip-content="Delete Test Probe"
                  >
                    <Image src="/delete.svg" alt="Delete" width={20} height={20} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="d-flex justify-content-center mt-3">
            <form onSubmit={handleRemoveAll}>
              <button
                type="submit"
                className="btn btn-primary fs-4 fw-bold text-nowrap scaleEffect"
              >
                Remove All
              </button>
            </form>
          </div>

          <Tooltip id="tp-tooltip" place="top" />
        </div>
      )}
    </>
  );
};

export default EditTPs;
