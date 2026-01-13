import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import React from "react";

const ChangePassword = (props: any) => {
  const { data: session } = useSession();
  const router = useRouter();
  const isMounted = useRef(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState<boolean>(false);

  // State for eye icon show/hide
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInsertButton = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget as any;
    const oldPassword = String(form.user_password.value);
    const newPassword = String(form.new_password.value);
    const confirmPassword = String(form.password_confirmation.value);

    // Client-side check: passwords must match
    if (newPassword !== confirmPassword) {
      props.openModalAction({
        title: "Error!",
        description: "New passwords do not match.",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return;
    }

    const userEmail: string = String(
      session?.user?.email || session?.user?.name || ""
    );

    if (!userEmail) {
      props.openModalAction({
        title: "Error!",
        description: "Cannot identify current user (missing email in session).",
        pictureUrl: "/undraw_cancel_u-1-it.svg",
        className: "text-center",
      });
      return;
    }

    makeDatabaseAction(
      "changePassword",
      userEmail,
      oldPassword,
      newPassword,
      confirmPassword
    )
      .then((result: Response) => result.json())
      .then((resultJSON: any) => {
        console.log("changePassword result:", resultJSON);

        if (resultJSON.status !== 200) {
          // Error from API
          props.openModalAction({
            title: "Error!",
            description: resultJSON.message || "Failed to change password.",
            pictureUrl: "/undraw_cancel_u-1-it.svg",
            className: "text-center",
          });
        } else {
          // ✅ Success
          props.openModalAction({
            title: "Success!",
            description:
              "The password has been changed successfully. You will be redirected to the sign-in page.",
            pictureUrl: "/confirm_OK.svg",
            className: "text-center",
          });

          // Reset form fields
          (e.target as HTMLFormElement).reset();

          // Check if this is the forced first login flow (?firstLogin=1)
          const isFirstLogin =
            (router.query.firstLogin as string | undefined) === "1";

          if (isFirstLogin) {
            // Small delay so user can see the success modal, then sign out
            setTimeout(() => {
              signOut({ callbackUrl: "/signin?pwChanged=1" });
            }, 2000);
          }
        }
      })
      .catch((err) => {
        console.error("Error in changePassword:", err);
        if (isMounted.current === true) {
          setConnectionTimedOut(true);
        }
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
          {/* Old password + eye icon (single outer border) */}
          <div className="form-control createProjectBarSize fw-bolder col mb-2 d-flex align-items-center">
            <input
              name="user_password"
              type={showOldPassword ? "text" : "password"}
              className="flex-grow-1 border-0 fw-bolder"
              placeholder="Old Password"
              aria-label="Old Password"
              style={{ boxShadow: "none", outline: "none" }}
              required
            />
            <button
              type="button"
              className="bg-transparent border-0 p-0 ms-2"
              onClick={() => setShowOldPassword((prev) => !prev)}
              style={{ cursor: "pointer", outline: "none", boxShadow: "none" }}
              tabIndex={-1}
            >
              <Image
                src={showOldPassword ? "/eye-slash.svg" : "/eye.svg"}
                alt={showOldPassword ? "Hide password" : "Show password"}
                width={20}
                height={20}
              />
            </button>
          </div>

          {/* New password + eye icon (single outer border) */}
          <div className="form-control createProjectBarSize fw-bolder col mb-2 d-flex align-items-center">
            <input
              name="new_password"
              type={showNewPassword ? "text" : "password"}
              className="flex-grow-1 border-0 fw-bolder"
              placeholder="New Password"
              aria-label="New Password"
              style={{ boxShadow: "none", outline: "none" }}
              required
            />
            <button
              type="button"
              className="bg-transparent border-0 p-0 ms-2"
              onClick={() => setShowNewPassword((prev) => !prev)}
              style={{ cursor: "pointer", outline: "none", boxShadow: "none" }}
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

          {/* Confirm password + eye icon (single outer border) */}
          <div className="form-control createProjectBarSize fw-bolder col mb-2 d-flex align-items-center">
            <input
              name="password_confirmation"
              type={showConfirmPassword ? "text" : "password"}
              className="flex-grow-1 border-0 fw-bolder"
              placeholder="Confirm New Password"
              aria-label="Confirm New Password"
              style={{ boxShadow: "none", outline: "none" }}
              required
            />
            <button
              type="button"
              className="bg-transparent border-0 p-0 ms-2"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              style={{ cursor: "pointer", outline: "none", boxShadow: "none" }}
              tabIndex={-1}
            >
              <Image
                src={showConfirmPassword ? "/eye-slash.svg" : "/eye.svg"}
                alt={showConfirmPassword ? "Hide password" : "Show password"}
                width={20}
                height={20}
              />
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary fs-4 fw-bold text-nowrap col mb-2 scaleEffect"
          >
            Change Password
          </button>
        </form>
      </div>
    </>
  );
};

export default ChangePassword;

const makeDatabaseAction = (
  actionParam: string,
  user_emailParam: string,
  user_passwordParam: string,
  new_passwordParam: string,
  password_confirmationParam: string
) => {
  return new Promise<Response>((resolve, reject) => {
    fetch("/api/getUsers", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: actionParam,
        user_email: user_emailParam,
        user_password: user_passwordParam,
        new_password: new_passwordParam,
        password_confirmation: password_confirmationParam,
      }),
    })
      .then((result) => resolve(result))
      .catch((err) => reject(err));
  });
};
