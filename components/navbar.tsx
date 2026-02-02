import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePlant } from "../contexts/Plantcontext";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";

type AppUser = {
  first_name?: string;
  last_name?: string;
  user_id?: string;
  user_group?: string;
  image?: string | null;
  name?: string | null;
};

const Navbar: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { selectedPlant, setSelectedPlant } = usePlant();
  const [plants, setPlants] = useState<{ label: string; value: string }[]>([]);

  const isSigninPage = router.pathname === "/signin";

  // Safe cast (session can be null)
  const appUser = (session?.user ?? null) as AppUser | null;

  const displayName =
    appUser && (appUser.first_name || appUser.last_name)
      ? `${appUser.first_name ?? ""} ${appUser.last_name ?? ""}`.trim()
      : appUser?.name || "User";

  const displayUserId = appUser?.user_id ?? "";

  // Fetch plants only if admin
  useEffect(() => {
    if (appUser?.user_group === "admin") {
      fetch("/api/getPlants")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setPlants(
              data.map((p: { plant_name: string }) => ({
                label: p.plant_name,
                value: p.plant_name,
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [appUser?.user_group]);

  return (
    <nav
      className="navbar navbar-expand-lg navbar-dark bg-primary"
      role="navigation"
    >
      <div className="container-fluid px-0 d-flex align-items-center justify-content-between flex-nowrap">
        {/* Brand on the left */}
        <Link href={session ? "/editprojects" : "/"} passHref>
          <a className="navbar-brand navbar-logo-link d-flex align-items-center">
            <Image
              src="/Logo.svg"
              alt="AUMOVIO Logo"
              layout="intrinsic"
              width={250}
              height={50}
              className="navbar-logo"
              priority
            />
          </a>
        </Link>

        {/* Right-side items */}
        <ul className="ms-auto navbar-right list-unstyled d-flex align-items-center mb-0 flex-nowrap">
          {session ? (
            <>
              {/* Admin: plant selector */}
              {appUser?.user_group === "admin" && (
                <li className="nav-item dropdown me-3 flex-shrink-0">
                  <a
                    className="nav-link buttons-hover d-inline-flex align-items-center"
                    href="#"
                    id="plantDropdown"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    title="Plant location"
                  >
                    <Image
                      src="/location.svg"
                      alt="Select Plant"
                      width={35}
                      height={35}
                      priority
                    />
                  </a>
                  <ul
                    className="dropdown-menu dropdown-menu-end custom-dropdown"
                    aria-labelledby="plantDropdown"
                  >
                    <li>
                      <button
                        type="button"
                        className="dropdown-item text-danger"
                        onClick={() => setSelectedPlant("")}
                      >
                        Show All
                      </button>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>
                    {plants.map((p, idx) => (
                      <li key={idx}>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() => setSelectedPlant(p.value)}
                        >
                          {p.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              )}

              {/* Selected plant */}
              {appUser?.user_group === "admin" && selectedPlant && (
                <li className="me-3 flex-shrink-0">
                  <span className="selected-plant-pill" title={selectedPlant}>
                    {selectedPlant}
                  </span>
                </li>
              )}

              {/* User avatar */}
              <li className="nav-item dropdown me-3 flex-shrink-0">
                <a
                  className="nav-link buttons-hover"
                  href="#"
                  id="userMenuDropdown"
                  role="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  title="User menu"
                >
                  <Image
                    src={appUser?.image ?? "/default-avatar.png"}
                    width={40}
                    height={40}
                    alt="User avatar"
                    className="rounded-circle"
                    priority
                  />
                </a>

                <ul
                  className="dropdown-menu dropdown-menu-end custom-dropdown"
                  aria-labelledby="userMenuDropdown"
                >
                  <li className="px-3 py-2 small text-muted">
                    <div className="dropdown-user-data">{displayName}</div>
                    {displayUserId && (
                      <div className="text-muted">
                        <span className="dropdown-user-data">
                          {displayUserId}
                        </span>
                      </div>
                    )}
                  </li>

                  <li>
                    <hr className="dropdown-divider" />
                  </li>

                  {appUser?.user_group === "admin" && (
                    <>
                      <li>
                        <Link href="/adduser" passHref>
                          <a className="dropdown-item">Add users</a>
                        </Link>
                      </li>
                      <li>
                        <Link href="/editusers" passHref>
                          <a className="dropdown-item">Edit users</a>
                        </Link>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>
                      <li>
                        <Link href="/manageplants" passHref>
                          <a className="dropdown-item">Plants management</a>
                        </Link>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>
                    </>
                  )}

                  <li>
                    <Link href="/changepassword" passHref>
                      <a className="dropdown-item">Reset password</a>
                    </Link>
                  </li>

                  <li>
                    <hr className="dropdown-divider" />
                  </li>

                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      Sign out
                    </button>
                  </li>
                </ul>
              </li>
            </>
          ) : (
            !isSigninPage && (
              <li className="nav-item me-3">
                <div className="signin-wrapper">
                  <Link href="/signin" passHref>
                    <button className="btn-signin menubuttons">
                      <span className="signin-text fw-bold">Sign in</span>
                      <Image
                        src="/login.svg"
                        alt="Login"
                        width={22}
                        height={22}
                        className="signin-icon"
                      />
                    </button>
                  </Link>
                </div>
              </li>
            )
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
