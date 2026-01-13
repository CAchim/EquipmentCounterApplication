import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ModalProps } from "./modal";

interface EditUsersProps {
  openModalAction: (parameters: ModalProps) => void;
}

interface User {
  entry_id: number;
  first_name: string;
  last_name: string;
  user_id: string;
  email: string;
  user_group: string;
}

const EditUsers = ({ openModalAction }: EditUsersProps) => {
  const [plants, setPlants] = useState<{ label: string; value: string }[]>([]);
  const [selectedPlant, setSelectedPlant] = useState("");

  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof User;
    direction: "asc" | "desc";
  } | null>(null);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  const [searchQuery, setSearchQuery] = useState("");

  // For combobox-style dropdowns
  const [plantSearch, setPlantSearch] = useState("");
  const [filteredPlants, setFilteredPlants] = useState<
    { label: string; value: string }[]
  >([]);
  const [isPlantDropdownOpen, setIsPlantDropdownOpen] = useState(false);
  const plantDropdownRef = useRef<HTMLDivElement | null>(null);

  const [groupSearch, setGroupSearch] = useState("");
  const [filteredGroups, setFilteredGroups] = useState<string[]>([]);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement | null>(null);

  // fetch plants
  useEffect(() => {
    fetch("/api/getPlants")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped = data.map((p: { plant_name: string }) => ({
            label: p.plant_name,
            value: p.plant_name,
          }));
          setPlants(mapped);
          setFilteredPlants(mapped);
        }
      })
      .catch(console.error);
  }, []);

  // keep plantSearch in sync with selectedPlant
  useEffect(() => {
    setPlantSearch(selectedPlant || "");
  }, [selectedPlant]);

  // filter plants as user types
  useEffect(() => {
    const lower = plantSearch.toLowerCase();
    setFilteredPlants(
      plants.filter((p) => p.label.toLowerCase().includes(lower))
    );
  }, [plantSearch, plants]);

  // fetch groups when plant selected
  useEffect(() => {
    if (!selectedPlant) {
      setGroups([]);
      setFilteredGroups([]);
      setSelectedGroup("");
      setGroupSearch("");
      return;
    }

    fetch(`/api/getGroups?plant=${encodeURIComponent(selectedPlant)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setGroups(data);
          setFilteredGroups(data);
        } else {
          setGroups([]);
          setFilteredGroups([]);
        }
      })
      .catch(console.error);
  }, [selectedPlant]);

  // keep groupSearch in sync with selectedGroup
  useEffect(() => {
    setGroupSearch(selectedGroup || "");
  }, [selectedGroup]);

  // filter groups as user types
  useEffect(() => {
    const lower = groupSearch.toLowerCase();
    setFilteredGroups(
      groups.filter((g) => g.toLowerCase().includes(lower))
    );
  }, [groupSearch, groups]);

  // Close PLANT dropdown on click outside
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

  // Close GROUP dropdown on click outside
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

  // fetch users (optionally for a given plant)
  const fetchUsers = async (plantOverride?: string) => {
    const plant = plantOverride || selectedPlant;
    if (!plant) return;

    try {
      const res = await fetch(
        `/api/getUsersByPlant?plant=${encodeURIComponent(plant)}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  // sorting
  const sortedUsers = [...users].sort((a, b) => {
    if (!sortConfig) return a.first_name.localeCompare(b.first_name);
    const { key, direction } = sortConfig;
    const order = direction === "asc" ? 1 : -1;
    return a[key].toString().localeCompare(b[key].toString()) * order;
  });

  const requestSort = (key: keyof User) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // remove user
  const handleRemove = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/removeUser?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        openModalAction({
          title: "Success!",
          description: "User removed successfully.",
          pictureUrl: "/confirm_OK.svg",
          className: "text-center",
        });
        fetchUsers();
      } else {
        openModalAction({
          title: "Error!",
          description: "Failed to remove user.",
          pictureUrl: "/undraw_cancel_u-1-it.svg",
          className: "text-center",
        });
      }
    } catch (err) {
      openModalAction({
        title: "Error!",
        description: "Unexpected error while removing user.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
    }
  };

  // start editing
  const handleEdit = (user: User) => {
    setEditingUserId(user.entry_id);
    setEditForm({ ...user });
  };

  // cancel editing
  const handleCancel = () => {
    setEditingUserId(null);
    setEditForm({});
  };

  // save edited user
  const handleSave = async (id: number) => {
    try {
      const res = await fetch("/api/editUser", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: id,
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          user_id: editForm.user_id,
          email: editForm.email,
          user_group: editForm.user_group,
        }),
      });
      const result = await res.json();
      console.log("Save result:", result);

      if (result.status_code === 200) {
        openModalAction({
          title: "Success!",
          description: result.message,
          pictureUrl: "/confirm_OK.svg",
          className: "text-center",
        });
        fetchUsers(); // refresh users list
        setEditingUserId(null);
      } else if (result.status_code === 304) {
        openModalAction({
          title: "Warning!",
          description: result.message,
          pictureUrl: "/undraw_cancel_u-1-it.svg",
          className: "text-center",
        });
      } else if (result.status_code === 404) {
        openModalAction({
          title: "Error!",
          description: result.message,
          pictureUrl: "/undraw_cancel_u-1-it.svg",
          className: "text-center",
        });
      } else {
        openModalAction({
          title: "Error!",
          description: "Unexpected error while editing user",
          pictureUrl: "/undraw_cancel_u-1-it.svg",
          className: "text-center",
        });
      }
    } catch (err) {
      console.error("Error saving user:", err);
      openModalAction({
        title: "Error!",
        description: "Request failed while editing user",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
    }
  };

  return (
    <div className="container mt-4 text-center">
      {/* Plant combobox (search + click-outside close) */}
      <div
        className="dropdown w-50 mx-auto mb-2"
        ref={plantDropdownRef}
      >
        <input
          type="text"
          className="form-control fw-bolder text-start dropdown-toggle"
          id="plantDropdown"
          placeholder="Select Plant"
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
            style={{ maxHeight: "225px", overflowY: "auto" }}
          >
            <li>
              <button
                type="button"
                className="dropdown-item text-danger"
                onClick={() => {
                  setSelectedPlant("");
                  setPlantSearch("");
                  setUsers([]);
                  setGroups([]);
                  setFilteredGroups([]);
                  setSelectedGroup("");
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

            {filteredPlants.map((p, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setSelectedPlant(p.value);
                    setPlantSearch(p.label);
                    setSelectedGroup("");
                    setGroupSearch("");
                    setUsers([]);
                    fetchUsers(p.value);
                    setIsPlantDropdownOpen(false);
                  }}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Group filter combobox */}
      {groups.length > 0 && (
        <div
          className="dropdown w-50 mx-auto mb-3"
          ref={groupDropdownRef}
        >
          <input
            type="text"
            className="form-control fw-bolder text-start dropdown-toggle"
            id="groupDropdown"
            placeholder="Filter by Group"
            value={groupSearch}
            onFocus={() => setIsGroupDropdownOpen(true)}
            onClick={() => setIsGroupDropdownOpen(true)}
            onChange={(e) => {
              setGroupSearch(e.target.value);
              setIsGroupDropdownOpen(true);
            }}
            autoComplete="off"
          />

          {isGroupDropdownOpen && (
            <ul
              className="dropdown-menu custom-dropdown w-100 group-dropdown show"
              aria-labelledby="groupDropdown"
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
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
                  Clear Filter
                </button>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>

              {filteredGroups.length === 0 && (
                <li className="dropdown-item disabled text-muted">
                  No groups found
                </li>
              )}

              {filteredGroups.map((g, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedGroup(g);
                      setGroupSearch(g);
                      setIsGroupDropdownOpen(false);
                    }}
                  >
                    {g}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        className="btn btn-secondary fw-bold w-50 mb-4"
        onClick={() => fetchUsers()}
      >
        Show Users
      </button>

      {/* Users table */}
      {users.length > 0 && (
        <div className="edit-users-table-wrapper">
          {/* Search box (only visible when users are loaded) */}
          <input
            type="text"
            className="form-control mb-3 fw-bold"
            style={{ width: "100%" }}
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <table className="table table-sm table-primary fontSmall fw-bold border-light table-bordered text-center align-middle table-hover">
            <thead>
              <tr>
                <th
                  className="bg-primary align-middle"
                  onClick={() => requestSort("first_name")}
                >
                  First Name
                </th>
                <th
                  className="bg-primary align-middle"
                  onClick={() => requestSort("last_name")}
                >
                  Last Name
                </th>
                <th
                  className="bg-primary align-middle"
                  onClick={() => requestSort("user_id")}
                >
                  User ID
                </th>
                <th
                  className="bg-primary align-middle"
                  onClick={() => requestSort("email")}
                >
                  Email
                </th>
                <th
                  className="bg-primary align-middle"
                  onClick={() => requestSort("user_group")}
                >
                  Group
                </th>
                <th className="bg-primary align-middle">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers
                .filter((u) => !selectedGroup || u.user_group === selectedGroup)
                .filter((u) =>
                  `${u.first_name} ${u.last_name} ${u.user_id} ${u.email} ${u.user_group}`
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
                )
                .map((u) => (
                  <tr key={u.entry_id}>
                    <td>
                      {editingUserId === u.entry_id ? (
                        <input
                          className="form-control form-control-sm"
                          value={editForm.first_name || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              first_name: e.target.value,
                            })
                          }
                        />
                      ) : (
                        u.first_name
                      )}
                    </td>
                    <td>
                      {editingUserId === u.entry_id ? (
                        <input
                          className="form-control form-control-sm"
                          value={editForm.last_name || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              last_name: e.target.value,
                            })
                          }
                        />
                      ) : (
                        u.last_name
                      )}
                    </td>
                    <td>
                      {editingUserId === u.entry_id ? (
                        <input
                          className="form-control form-control-sm"
                          value={editForm.user_id || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              user_id: e.target.value,
                            })
                          }
                        />
                      ) : (
                        u.user_id
                      )}
                    </td>
                    <td>
                      {editingUserId === u.entry_id ? (
                        <input
                          className="form-control form-control-sm"
                          value={editForm.email || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              email: e.target.value,
                            })
                          }
                        />
                      ) : (
                        u.email
                      )}
                    </td>
                    <td style={{ position: "static" }}>
                      {editingUserId === u.entry_id ? (
                        <div className="dropdown position-relative">
                          <button
                            className="form-control form-control-sm text-start fw-bolder"
                            type="button"
                            id={`groupDropdown-${u.entry_id}`}
                            data-bs-toggle="dropdown"
                            data-bs-display="static"
                            aria-expanded="false"
                          >
                            {editForm.user_group || "Select Group"}
                          </button>
                          <ul
                            className="dropdown-menu custom-dropdown w-100 group-dropdown"
                            style={{ maxHeight: "100px", overflowY: "auto" }}
                            aria-labelledby={`groupDropdown-${u.entry_id}`}
                          >
                            {groups.map((g, idx) => (
                              <li key={idx}>
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() =>
                                    setEditForm({
                                      ...editForm,
                                      user_group: g,
                                    })
                                  }
                                >
                                  {g}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        u.user_group
                      )}
                    </td>
                    <td className="d-flex justify-content-center gap-2">
                      {editingUserId === u.entry_id ? (
                        <>
                          <button
                            className="btn btn-success btn-sm border-0"
                            title="Save user"
                            onClick={() => handleSave(u.entry_id)}
                          >
                            <Image
                              src="/save.svg"
                              alt="Save"
                              width={20}
                              height={20}
                            />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm border-0"
                            title="Cancel edit"
                            onClick={handleCancel}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-edit btn-sm border-0"
                            title="Edit user"
                            onClick={() => handleEdit(u)}
                          >
                            <Image
                              src="/edit.svg"
                              alt="Edit"
                              width={20}
                              height={20}
                            />
                          </button>
                          <button
                            className="btn btn-primary btn-sm border-0"
                            title="Remove user"
                            onClick={() => handleRemove(u.entry_id)}
                          >
                            <Image
                              src="/delete.svg"
                              alt="Delete"
                              width={20}
                              height={20}
                            />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EditUsers;
