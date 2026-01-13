import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const AddNewUser = (props: any) => {
  const { data: session } = useSession();
  const isMounted = useRef(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState<any>(false);

    // State for eye icon show/hide
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // PLANTS
  const [plants, setPlants] = useState<{ label: string; value: string }[]>([]);
  const [filteredPlants, setFilteredPlants] = useState<
    { label: string; value: string }[]
  >([]);
  const [selectedPlant, setSelectedPlant] = useState("");
  const [plantSearch, setPlantSearch] = useState("");
  const [isPlantDropdownOpen, setIsPlantDropdownOpen] = useState(false);
  const plantDropdownRef = useRef<HTMLDivElement | null>(null);

  // GROUPS (dependent on selectedPlant)
  const [groups, setGroups] = useState<string[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement | null>(null);

  // Load plants
  useEffect(() => {
    fetch("/api/getPlants")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped = data.map((plant: { plant_name: string }) => ({
            label: plant.plant_name,
            value: plant.plant_name,
          }));
          setPlants(mapped);
          setFilteredPlants(mapped);
        }
      })
      .catch(console.error);
  }, []);

  // Keep plantSearch synced with selectedPlant
  useEffect(() => {
    setPlantSearch(selectedPlant || "");
  }, [selectedPlant]);

  // Filter plants by plantSearch
  useEffect(() => {
    const lower = plantSearch.toLowerCase();
    setFilteredPlants(
      plants.filter((p) => p.label.toLowerCase().includes(lower))
    );
  }, [plantSearch, plants]);

  // Fetch groups whenever the plant changes
  useEffect(() => {
    setSelectedGroup("");
    setGroupSearch("");
    setGroups([]);
    setFilteredGroups([]);
    setIsGroupDropdownOpen(false);

    if (!selectedPlant) return;

    setGroupsLoading(true);
    fetch(`/api/getGroups?plant=${encodeURIComponent(selectedPlant)}`)
      .then((r) => r.json())
      .then((list: string[]) => {
        const arr = Array.isArray(list) ? list : [];
        setGroups(arr);
        setFilteredGroups(arr);
      })
      .catch(console.error)
      .finally(() => setGroupsLoading(false));
  }, [selectedPlant]);

  // Keep groupSearch synced with selectedGroup
  useEffect(() => {
    setGroupSearch(selectedGroup || "");
  }, [selectedGroup]);

  // Filter groups by groupSearch
  useEffect(() => {
    const lower = groupSearch.toLowerCase();
    setFilteredGroups(
      groups.filter((g) => g.toLowerCase().includes(lower))
    );
  }, [groupSearch, groups]);

  // Close PLANT dropdown when clicking outside
  useEffect(() => {
    if (!isPlantDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        plantDropdownRef.current &&
        !plantDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPlantDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPlantDropdownOpen]);

  // Close GROUP dropdown when clicking outside
  useEffect(() => {
    if (!isGroupDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        groupDropdownRef.current &&
        !groupDropdownRef.current.contains(event.target as Node)
      ) {
        setIsGroupDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isGroupDropdownOpen]);

  const handleInsertButton = (e: any) => {
    e.preventDefault();

    makeDatabaseAction(
      "addUser",
      String(e.target.first_name.value),
      String(e.target.last_name.value),
      String(e.target.user_id.value),
      String(e.target.email.value),
      //String(e.target.user_password.value),
      selectedGroup, // from dropdown
      selectedPlant
    )
      .then((result: any) => result.json())
      .then((resultJSON: any) => {
        console.log(resultJSON);

        if (resultJSON.status === 500) {
          props.openModalAction({
            title: "Error!",
            description: resultJSON.message || "Unexpected database error.",
            pictureUrl: "/undraw_cancel_u-1-it.svg",
            className: "text-center",
          });
        } else if (resultJSON.status === 404) {
          props.openModalAction({
            title: "Error!",
            description: resultJSON.message,
            pictureUrl: "/undraw_cancel_u-1-it.svg",
            className: "text-center",
          });
        } else if (resultJSON.status === 409) {
          props.openModalAction({
            title: "Error!",
            description:
              resultJSON.message ||
              "User ID or email already exists. Please choose another.",
            pictureUrl: "/undraw_cancel_u-1-it.svg",
            className: "text-center",
          });
        } else if (resultJSON.status === 200) {
          props.openModalAction({
            title: "Success!",
            description: "User has been successfully added!",
            pictureUrl: "/confirm_OK.svg",
            className: "text-center",
          });

          // Reset the form inputs
          e.target.reset();
          setSelectedPlant("");
          setPlantSearch("");
          setIsPlantDropdownOpen(false);
          setSelectedGroup("");
          setGroupSearch("");
          setIsGroupDropdownOpen(false);
        } else {
          // Any other unexpected status
          props.openModalAction({
            title: "Error!",
            description:
              resultJSON.message ||
              `Unexpected status code: ${resultJSON.status}`,
            pictureUrl: "/undraw_cancel_u-1-it.svg",
            className: "text-center",
          });
        }
      })
      .catch((err) => {
        console.error(err);
        props.openModalAction({
          title: "Error!",
          description:
            "Client-side error occurred. Check console for details.",
          pictureUrl: "/undraw_cancel_u-1-it.svg",
          className: "text-center",
        });
      });
  };


  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (connectionTimedOut) {
    return (
      <>
        <div className="d-flex flex-column align-items-center justify-content-center screen-80 ">
          <Image
            src="/undraw_questions_re_1fy7.svg"
            height={250}
            width={800}
            alt="Error Picture"
            priority
            className="animate__animated animate__bounceIn"
          />
          <p className="text-danger display-3 text-center p-5">
            Database did not respond, please contact your administrator!
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="container text-center createProjectBarWidth mt-2">
        <form
          className="d-flex flex-column justify-content-center align-items-center"
          method="post"
          onSubmit={handleInsertButton}
        >
          {/* Plant combobox (search + click-outside close) */}
          <div
            className="dropdown w-100 mb-2"
            ref={plantDropdownRef}
          >
            <input
              type="text"
              className="form-control createProjectBarSize fw-bolder dropdown-toggle"
              id="plantDropdown"
              placeholder="Select plant"
              value={plantSearch}
              onFocus={() => setIsPlantDropdownOpen(true)}
              onClick={() => setIsPlantDropdownOpen(true)}
              onChange={(e) => {
                setPlantSearch(e.target.value);
                setIsPlantDropdownOpen(true);
              }}
              autoComplete="off"
            />

            {isPlantDropdownOpen && (
              <ul
                className="dropdown-menu custom-dropdown w-100 plant-dropdown show"
                aria-labelledby="plantDropdown"
                style={{ maxHeight: "250px", overflowY: "auto" }}
              >
                <li>
                  <button
                    type="button"
                    className="dropdown-item text-danger"
                    onClick={() => {
                      setSelectedPlant("");
                      setPlantSearch("");
                      setIsPlantDropdownOpen(false);
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

                {filteredPlants.map((plant, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setSelectedPlant(plant.value);
                        setIsPlantDropdownOpen(false);
                      }}
                    >
                      {plant.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input type="hidden" name="user_plant" value={selectedPlant} />
          </div>

          <input
            name="first_name"
            type="text"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="First name"
            aria-label="Name"
            required
          />
          <input
            name="last_name"
            type="text"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="Last name"
            aria-label="Surname"
            required
          />
          <input
            name="user_id"
            type="text"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="User ID"
            aria-label="User ID"
            required
          />
          <input
            name="email"
            type="email"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="Owner email"
            aria-label="Email"
            required
          />
          {/*<div className="form-control createProjectBarSize fw-bolder col mb-2 d-flex align-items-center">
            <input
              name="user_password"
              type={showNewPassword ? "text" : "password"}
              className="flex-grow-1 border-0 fw-bolder"
              placeholder="Password"
              aria-label="Password"
              style={{ boxShadow: "none", outline: "none" }}
              required
            />

            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="bg-transparent border-0 p-0 ms-2"
              style={{
                cursor: "pointer",
                outline: "none",
                boxShadow: "none",
              }}
              tabIndex={-1}
            >
              <Image
                src={showNewPassword ? "/eye-slash.svg" : "/eye.svg"}
                alt={showNewPassword ? "Hide password" : "Show password"}
                width={20}
                height={20}
              />
            </button>
          </div>
          {/* Group combobox (dependent on plant, with search + click-outside close) */}
          <div
            className="dropdown w-100 mb-2"
            ref={groupDropdownRef}
          >
            <input
              type="text"
              className="form-control createProjectBarSize fw-bolder dropdown-toggle"
              id="groupDropdown"
              placeholder={
                !selectedPlant
                  ? "Select the plant location first"
                  : groupsLoading
                  ? "Loading groups…"
                  : "Select Group"
              }
              value={groupSearch}
              onFocus={() => {
                if (selectedPlant && !groupsLoading) {
                  setIsGroupDropdownOpen(true);
                }
              }}
              onClick={() => {
                if (selectedPlant && !groupsLoading) {
                  setIsGroupDropdownOpen(true);
                }
              }}
              onChange={(e) => {
                setGroupSearch(e.target.value);
                if (selectedPlant && !groupsLoading) {
                  setIsGroupDropdownOpen(true);
                }
              }}
              autoComplete="off"
              disabled={!selectedPlant || groupsLoading}
            />

            {isGroupDropdownOpen && (
              <ul
                className="dropdown-menu custom-dropdown w-100 plant-dropdown show"
                aria-labelledby="groupDropdown"
                style={{ maxHeight: "150px", overflowY: "auto" }}
              >
                {(!selectedPlant || groupsLoading) && (
                  <li className="px-3 py-2 text-muted">
                    {!selectedPlant
                      ? "Choose a plant to load groups"
                      : "Loading…"}
                  </li>
                )}

                {selectedPlant && !groupsLoading && (
                  <>
                    <li>
                      <button
                        type="button"
                        className="dropdown-item text-danger"
                        onClick={() => {
                          setSelectedGroup("");
                          setGroupSearch("");
                          setIsGroupDropdownOpen(false);
                        }}
                      >
                        Clear Selection
                      </button>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>

                    {filteredGroups.length === 0 ? (
                      <li className="px-3 py-2 text-muted">
                        No groups for the selected plant
                      </li>
                    ) : (
                      filteredGroups.map((group, idx) => (
                        <li key={idx}>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              setSelectedGroup(group);
                              setIsGroupDropdownOpen(false);
                            }}
                          >
                            {group}
                          </button>
                        </li>
                      ))
                    )}
                  </>
                )}
              </ul>
            )}

            {/* keep this so submit body stays identical */}
            <input type="hidden" name="user_group" value={selectedGroup} />
          </div>

          <button
            type="submit"
            className="btn btn-primary fs-4 fw-bold text-nowrap col mb-2 scaleEffect"
          >
            Add user
          </button>
        </form>
      </div>
    </>
  );
};

export default AddNewUser;

const makeDatabaseAction = (
  actionParam: string,
  first_nameParam: string,
  last_nameParam: string,
  user_idParam: string,
  emailParam: string,
  //user_passwordParam: string,
  user_groupParam: string,
  user_plantParam: string
) => {
  return new Promise((resolve, reject) => {
    fetch("/api/getUsers", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "omit",
      body: JSON.stringify({
        action: actionParam,
        first_name: first_nameParam,
        last_name: last_nameParam,
        user_id: user_idParam,
        email: emailParam,
        //user_password: user_passwordParam,
        user_group: user_groupParam,
        user_plant: user_plantParam,
      }),
    })
      .then((result) => resolve(result))
      .catch((err) => reject(err));
  });
};
