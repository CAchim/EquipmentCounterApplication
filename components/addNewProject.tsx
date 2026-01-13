import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ModalProps } from "../components/modal";

type AddNewProjectProps = {
  openModalAction: (args: ModalProps) => void; // <-- match adduser.tsx exactly
};

const AddNewProject = ({ openModalAction }: AddNewProjectProps) => {
  const { data: session } = useSession();
  const isAdmin = session?.user?.user_group === "admin";

  const isMounted = useRef(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);

   // Admin plant dropdown state
  const [plants, setPlants] = useState<string[]>([]);
  const [fixturePlant, setFixturePlant] = useState<string>("");
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [plantSearch, setPlantSearch] = useState<string>("");

  // Ref for click-outside handling
  const plantDropdownRef = useRef<HTMLDivElement | null>(null);

  // Load plants for admin
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

  const filteredPlants = plants.filter((p) =>
    p.toLowerCase().includes(plantSearch.toLowerCase())
  );

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

  const handleInsertButton = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget as any;

    // Admin must choose a plant
    if (isAdmin && !fixturePlant.trim()) {
      openModalAction({
        title: "Error!",
        description: "Please select a Fixture plant before creating the equipment.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return;
    }

    const user: string = String(session?.user?.email || session?.user?.name);

    const payload: Record<string, any> = {
      action: "createProject",
      project_name: String(form.project_name.value),
      adapter_code: String(form.adapter_code.value),
      fixture_type: String(form.fixture_type.value),
      owner_email: String(form.owner_email.value),
      contacts_limit: parseInt(form.contacts_limit.value, 10),
      warning_at: parseInt(form.warning_at.value, 10),
      modified_by: user,
    };

    if (isAdmin && fixturePlant.trim()) {
      payload.fixture_plant = fixturePlant.trim();
    }

    makeDatabaseAction(payload)
      .then(async (res: Response) => {
        const resultJSON: any = await res.json().catch(() => ({}));

        // Normalize common DB constraint message
        if (
          (res.status >= 400 || resultJSON?.status >= 400) &&
          resultJSON?.message?.sqlMessage?.includes?.("constraint")
        ) {
          resultJSON.message.sqlMessage = "Please insert the limit higher than the warning!";
        }

        if (!res.ok || resultJSON?.status >= 400) {
          openModalAction({
            title: "Error!",
            description:
              resultJSON?.message?.sqlMessage ||
              resultJSON?.message ||
              "Creation failed. Please verify the fields.",
            pictureUrl: "/undraw_cancel_u-1-it.svg",
            className: "text-center",
          });
          return;
        }

        const ok =
          resultJSON?.message &&
          (typeof resultJSON.message.affectedRows === "number"
            ? resultJSON.message.affectedRows > 0
            : !!resultJSON.message.insertId);

        if (ok) {
          openModalAction({
            title: "Success!",
            description: "Project has been successfully created!",
            pictureUrl: "/confirm_OK.svg",
            className: "text-center",
          });
          (e.target as HTMLFormElement).reset();
          setFixturePlant("");
          setPlantSearch("");
        } else {
          openModalAction({
            title: "Error!",
            description:
              "Creation failed. Please verify the fields or if the project already exists.",
            pictureUrl: "/undraw_cancel_u-1-it.svg",
            className: "text-center",
          });
        }
      })
      .catch((err) => {
        console.log(err);
        if (isMounted.current === true) setConnectionTimedOut(true);
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
          <input
            name="project_name"
            type="text"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="Project name"
            aria-label="Project"
            required
          />
          <input
            name="adapter_code"
            type="text"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="Adapter code"
            aria-label="Adapter"
            required
          />
          <input
            name="fixture_type"
            type="text"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="Fixture type"
            aria-label="Fixture type"
            required
          />
          {/* Admin-only plant combobox (search + display in same box) */}
          {isAdmin && (
            <div className="dropdown dropup w-100 mb-2"
	    	ref={plantDropdownRef}
	    >
              <input
                type="text"
                className="form-control createProjectBarSize fw-bolder col dropdown-toggle"
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
                  style={{ maxHeight: "300px", overflowY: "auto" }}
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
          <input
            name="owner_email"
            type="email"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="Owner email"
            aria-label="Owner"
            required
          />      
          <input
            name="contacts_limit"
            type="number"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="Limit"
            aria-label="Limit"
            required
          />
          <input
            name="warning_at"
            type="number"
            className="form-control createProjectBarSize fw-bolder col mb-2"
            placeholder="Warning"
            aria-label="Warning"
            required
          />

          <button
            type="submit"
            className="btn btn-primary fs-4 fw-bold text-nowrap col mb-2 scaleEffect"
          >
            Create
          </button>
        </form>
      </div>
    </>
  );
};

export default AddNewProject;

const makeDatabaseAction = (payload: Record<string, any>) => {
  return new Promise<Response>((resolve, reject) => {
    fetch("/api/getCounterInfo", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((result) => resolve(result))
      .catch((err) => reject(err));
  });
};
