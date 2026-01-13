import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Tooltip } from "react-tooltip";

interface AddTestProbesProps {
  openModalAction: Function;
}

interface TestProbe {
  part_number: string;
  quantity: number;
  editing?: boolean;
}

const AddTestProbes = ({ openModalAction }: AddTestProbesProps) => {
  const { data: session } = useSession();
  const adapterCodeRef = useRef<HTMLInputElement>(null);
  const fixtureTypeRef = useRef<HTMLInputElement>(null);
  const partNumberRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const MAX_PROBES = 10;

  const [testProbes, setTestProbes] = useState<TestProbe[]>([]);
  const [showProbeList, setShowProbeList] = useState(false);

  const isAdmin = session?.user?.user_group === "admin";

  // Plant-related state (admin-only combobox)
  const [plants, setPlants] = useState<string[]>([]);
  const [fixturePlant, setFixturePlant] = useState<string>("");
  const [plantSearch, setPlantSearch] = useState<string>("");
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  // Ref for click-outside handling
  const plantDropdownRef = useRef<HTMLDivElement | null>(null);

  // Load plants for admin (same pattern as AddNewProject / EditTPs)
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
          // ignore; any error will show in downstream behavior if relevant
        });
    }
  }, [isAdmin]);

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

  const requirePlantIfAdmin = (): boolean => {
    if (isAdmin && !fixturePlant.trim()) {
      openModalAction({
        title: "Error!",
        description: "Please select a Fixture plant location first.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return false;
    }
    return true;
  };

  const handleAddTestProbe = () => {
    const part_number = partNumberRef.current?.value.trim() || "";
    const quantity = parseInt(quantityRef.current?.value.trim() || "0");

    if (testProbes.length >= MAX_PROBES) {
      openModalAction({
        title: "Limit Reached",
        description: `You can add up to ${MAX_PROBES} test probes only.`,
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return;
    }

    if (!part_number || isNaN(quantity) || quantity <= 0) {
      openModalAction({
        title: "Error!",
        description: "Please enter a valid part number and quantity!",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return;
    }

    const exists = testProbes.some((tp) => tp.part_number === part_number);
    if (exists) {
      openModalAction({
        title: "Error!",
        description: "This part number is already in the list!",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return;
    }

    setTestProbes((prev) => [...prev, { part_number, quantity }]);
    setShowProbeList(true);
    if (partNumberRef.current) partNumberRef.current.value = "";
    if (quantityRef.current) quantityRef.current.value = "";
  };

  const handleRemoveOne = (index: number) => {
    const updated = [...testProbes];
    updated.splice(index, 1);
    setTestProbes(updated);
    if (updated.length === 0) setShowProbeList(false);
  };

  const toggleEdit = (index: number) => {
    const updated = [...testProbes];
    updated[index].editing = true;
    setTestProbes(updated);
  };

  const handleSave = (index: number, newPN: string, newQty: number) => {
    const updated = [...testProbes];
    updated[index] = {
      part_number: newPN.trim(),
      quantity: newQty,
      editing: false,
    };
    setTestProbes(updated);
  };

  const handleSubmitAll = async () => {
    const adapter_code = adapterCodeRef.current?.value.trim();
    const fixture_type = fixtureTypeRef.current?.value.trim();

    if (!adapter_code || !fixture_type) {
      alert("Please enter both Adapter Code and Fixture Type.");
      return;
    }

    if (!requirePlantIfAdmin()) return;

    if (testProbes.length === 0) {
      alert("No test probes to submit.");
      return;
    }

    const preparedProbes = testProbes.filter(
      (probe) => probe.part_number?.trim() && !isNaN(probe.quantity)
    );

    if (preparedProbes.length !== testProbes.length) {
      alert("Each test probe must have a valid part number and quantity.");
      return;
    }

    try {
      const response = await fetch("/api/addTPs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapter_code,
          fixture_type,
          fixture_plant: fixturePlant.trim() || undefined,
          modified_by:
            session?.user?.email || session?.user?.name || "ROOT",
          testProbes: preparedProbes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        openModalAction({
          title: "Error!",
          description:
            typeof data?.message === "string"
              ? data.message
              : "Failed to add test probes.",
          pictureUrl: "/undraw_cancel_u-1-it.svg",
          className: "text-center",
        });
        return;
      }

      openModalAction({
        title: "Success!",
        description:
          typeof data?.message === "string"
            ? data.message
            : "All test probes added successfully.",
        pictureUrl: "/confirm_OK.svg",
        className: "text-center",
      });

      setTestProbes([]);
      setShowProbeList(false);
    } catch (error: any) {
      openModalAction({
        title: "Error!",
        description: error?.message || "Internal Server Error.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
    }
  };

  return (
    <div className="container mt-2 text-center">
      <form className="d-flex flex-column align-items-center">
        <div className="input-section">
          <input
            ref={adapterCodeRef}
            type="text"
            placeholder="Adapter Code"
            className="form-control input-fields fw-bold"
            required
          />
          <input
            ref={fixtureTypeRef}
            type="text"
            placeholder="Fixture Type"
            className="form-control input-fields fw-bold"
            required
          />

          {/* Admin-only plant combobox (same style as EditTPs) */}
          {isAdmin && (
            <div
              className="dropdown dropup w-100 mb-2"
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
                  style={{ maxHeight: "200px", overflowY: "auto" }}
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

        <div className="d-flex gap-2 mb-2 w-100 justify-content-center">
          <input
            ref={partNumberRef}
            type="text"
            placeholder="Part Number"
            className="form-control test-probe-input-list test-probe-text"
          />
          <input
            ref={quantityRef}
            type="number"
            min={1}
            placeholder="Qty"
            className="form-control qty-input-list test-probe-text"
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary fw-bold scaleEffect"
          onClick={handleAddTestProbe}
        >
          Add
        </button>
        <p className="text-muted mt-1 probe-limit-text">
          {testProbes.length}/{MAX_PROBES} probes added
        </p>
      </form>

      {showProbeList && (
        <div className="container">
          <ul className="list-group add-test-probe-list mx-auto">
            {testProbes.map((probe, idx) => (
              <li
                key={idx}
                className="list-group-item d-flex justify-content-between align-items-center gap-2"
              >
                {probe.editing ? (
                  <>
                    <input
                      type="text"
                      defaultValue={probe.part_number}
                      className="form-control w-50"
                      onChange={(e) => (probe.part_number = e.target.value)}
                    />
                    <input
                      type="number"
                      min={1}
                      defaultValue={probe.quantity}
                      className="form-control w-25"
                      onChange={(e) =>
                        (probe.quantity = parseInt(e.target.value, 10))
                      }
                    />
                    <div className="d-flex gap-1">
                      <button
                        onClick={() =>
                          handleSave(idx, probe.part_number, probe.quantity)
                        }
                        className="btn btn-success btn-sm border-0"
                        data-tooltip-id="tp-tooltip"
                        data-tooltip-content="Save changes"
                      >
                        <Image
                          src="/save.svg"
                          alt="Save"
                          width={20}
                          height={20}
                        />
                      </button>
                      <button
                        onClick={() => handleRemoveOne(idx)}
                        className="btn btn-danger btn-sm border-0"
                        data-tooltip-id="tp-tooltip"
                        data-tooltip-content="Delete this test probe"
                      >
                        <Image
                          src="/delete.svg"
                          alt="Delete"
                          width={20}
                          height={20}
                        />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="fw-bold">
                      PN: {probe.part_number} — Qty: {probe.quantity}
                    </span>
                    <div className="d-flex gap-1">
                      <button
                        onClick={() => toggleEdit(idx)}
                        className="btn btn-edit btn-sm border-0"
                        data-tooltip-id="tp-tooltip"
                        data-tooltip-content="Edit Test Probe"
                      >
                        <Image
                          src="/edit.svg"
                          alt="Edit"
                          width={20}
                          height={20}
                        />
                      </button>
                      <button
                        onClick={() => handleRemoveOne(idx)}
                        className="btn btn-primary btn-sm border-0"
                        data-tooltip-id="tp-tooltip"
                        data-tooltip-content="Delete Test Probe"
                      >
                        <Image
                          src="/delete.svg"
                          alt="Delete"
                          width={20}
                          height={20}
                        />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="d-flex justify-content-center mt-1">
            <button
              type="button"
              onClick={handleSubmitAll}
              className="btn btn-success fw-bold text-nowrap scaleEffect"
            >
              Submit All
            </button>
          </div>
        </div>
      )}
      {/* Tooltip container */}
      <Tooltip id="tp-tooltip" place="top" />
    </div>
  );
};

export default AddTestProbes;
