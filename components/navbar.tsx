import Image from "next/image";
import React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

const Navbar = () => {
  const { data: session } = useSession();
  const pictureWidth = 250;
  const pictureHeight = 75;
  return (
    <nav className="" role="navigation">
      <div className="container d-flex justify-content-around align-items-center">
        <Link href={!session ? "/" : "/editprojects"} passHref>
          <a className="btn scaleEffect">
            <Image
              src="/ContiPic.PNG"
              width={pictureWidth}
              height={pictureHeight}
              alt="continentalPicture"
              className="img-fluid"
              priority
            ></Image>
          </a>
        </Link>

        <ul className="list-unstyled display-6 d-flex pt-1 pb-4 pb-md-0 justify-align-content-between align-items-center">
          {session ? (
            <>
            {/* @ts-ignore */}
            {session?.user?.user_group =='admin'? 
              (
              <li className="nav-item pt-3 pt-md-0">
                <Link href="/adduser" passHref={true}>                
                  <button className="btn btn-primary fw-bold fs-5 scaleEffect me-5">
                    Add user
                  </button>
                </Link>
              </li>
              ):null}
              {/* @ts-ignore */}
              {session?.user?.user_group =='admin'? 
              (
              <li className="nav-item pt-3 pt-md-0">
                <Link href="/removeuser" passHref={true}>                
                  <button className="btn btn-primary fw-bold fs-5 scaleEffect me-5">
                    Remove user
                  </button>
                </Link>
              </li>  
              ):null}
              {/* @ts-ignore */}
              {session?.user?.user_group =='admin' || session?.user?.user_group =='TDE'? 
              (
              <li className="nav-item pt-3 pt-md-0">
                <Link href="/createproject" passHref={true}>                
                  <button className="btn btn-primary fw-bold fs-5 scaleEffect me-5">
                    Add Equipment
                  </button>
                </Link>
              </li>
              ):null} 
              {/* @ts-ignore */}
              {session?.user?.user_group =='admin' || session?.user?.user_group =='TDE'? 
              (
              <li className="nav-item pt-3 pt-md-0">
                <Link href="/addtestprobes" passHref={true}>                
                  <button className="btn btn-primary fw-bold fs-5 scaleEffect me-5">
                    Add test probes
                  </button>
                </Link>
              </li>
              ):null} 
              {/* @ts-ignore */}
              {session?.user?.user_group =='admin' || session?.user?.user_group =='TDE'? 
              (
              <li className="nav-item pt-3 pt-md-0">
                <Link href="/removetps" passHref={true}>                
                  <button className="btn btn-primary fw-bold fs-5 scaleEffect me-5">
                    Remove test probes
                  </button>
                </Link>
              </li>
              ):null} 
              {/* @ts-ignore */}
              {session?.user?.user_group =='admin' || session?.user?.user_group =='TDE' || session?.user?.user_group =='maintenance'? 
              (
              <li className="nav-item pt-3 pt-md-0">
                <Link href="/changepassword" passHref={true}>                
                  <button className="btn btn-primary fw-bold fs-5 scaleEffect me-5">
                    Change Password
                  </button>
                </Link>
              </li>
              ):null}
              <li className="nav-item pt-3 pt-md-0">
                <Link href="" passHref={true}>
                  <button
                    className="btn btn-primary fw-bold fs-5 scaleEffect"
                    onClick={() => {
                      signOut();
                    }}
                  >
                    Sign out
                  </button>
                </Link>
              </li>
            </>
          ) : (
            <li className="nav-item pt-3 pt-md-0">
              <Link href="/signin" passHref={true}>
                <button className="btn btn-primary fw-bold fs-5 scaleEffect">
                  Sign in
                </button>
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};
export default Navbar;
