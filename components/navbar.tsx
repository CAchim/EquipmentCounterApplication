import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePlant } from "../contexts/Plantcontext";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";

const Navbar: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { selectedPlant, setSelectedPlant } = usePlant();
  const [plants, setPlants] = useState<{ label: string; value: string }[]>([]);

  const isSigninPage = router.pathname === "/signin";

  // Fetch plants only if admin
  useEffect(() => {
    if (session?.user?.user_group === "admin") {
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
  }, [session]);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary" role="navigation">
      <div className="container-fluid px-0 d-flex align-items-center">
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
              {/* Admin: location icon + dropdown (left of avatar) */}
              {session.user.user_group === "admin" && (
                <li className="nav-item dropdown me-3 order-1 flex-shrink-0">
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
                    <li><hr className="dropdown-divider" /></li>
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

              {/* Selected plant shown BETWEEN location icon and avatar */}
              {session.user.user_group === "admin" && selectedPlant && (
                <li className="me-3 order-2 flex-grow-0">
                  <span className="selected-plant-pill" title={selectedPlant}>
                    {selectedPlant}
                  </span>
                </li>
              )}

              {/* Avatar + dropdown menu (rightmost) */}
              <li className="nav-item dropdown me-3 order-3 flex-shrink-0">
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
                    src={session.user.image ?? "/default-avatar.png"}
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
                  {session.user.user_group === "admin" && (
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

                  {/* Reset password */}
                  <li>
                    <Link href="/changepassword" passHref>
                      <a className="dropdown-item">Reset password</a>
                    </Link>
                  </li>

                  <li>
                    <hr className="dropdown-divider" />
                  </li>

                  {/* Sign out */}
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
              <li className="nav-item pt-3 pt-md-0 me-3">
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
