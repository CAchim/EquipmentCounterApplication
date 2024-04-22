import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const ChangePassword = (props: any) => {
  const { data: session, status } = useSession();
  const isMounted = useRef(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState<any>(false);

  const handleInsertButton = (e: any) => {
    e.preventDefault();

    const user: string = String(session?.user?.email || session?.user?.name);
    makeDatabaseAction(
      "changePassword",
      user,
      String(e.target.user_password.value),
      String(e.target.new_password.value),
      String(e.target.password_confirmation.value)

    )
      .then((result: any) => result.json())
      .then((resultJSON: any) => {
        console.log(resultJSON.message);
        if (resultJSON.status === 500) {
          if (
            resultJSON.message.code === "ER_ACCESS_DENIED_ERROR" ||
            resultJSON.message.code === "ECONNREFUSED"
          )
            throw "Cannot connect to DB";

          if (resultJSON.message.sqlMessage?.includes("constraint")) {
            resultJSON.message.sqlMessage =
              "The password was not changed!";
          }
          props.openModalAction({
            title: "Error!",
            description: resultJSON.message.sqlMessage,
            pictureUrl: "/undraw_cancel_u-1-it.svg",
            className: "text-center",
          });
        } else if (resultJSON.status === 200) {
          console.log(resultJSON);
          if (resultJSON.message.affectedRows === 1) {
            props.openModalAction({
              title: "Success!",
              description: "The password has been changed successfully",
              pictureUrl: "/confirm_OK.svg",
              className: "text-center",
            });
            e.target.reset();
          }
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
          ></Image>
          <p className="text-danger display-3 text-center p-5">
            Database did not respond, please contact your administrator!
          </p>
        </div>
      </>
    );
  } else
    return (
      <>
        <div className="container text-center createProjectBarWidth mt-3">
          <form
            className="d-flex flex-column justify-content-center align-items-center"
            method="post"
            onSubmit={handleInsertButton}
          >
            <input
              name="user_password"
              type="text"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Old Password"
              aria-label="Old Password"
              required
            ></input>
            <input
              name="new_password"
              type="text"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="New Password"
              aria-label="New Password"
              required
            ></input>
            <input
              name="password_confirmation"
              type="text"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Confirm New Password"
              aria-label="Confirm New Password"
              required
            ></input>
            <button
              type="submit"
              className="btn btn-primary fs-4 fw-bold text-nowrap col mb-3 scaleEffect"
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
  user_passwordParam : string,
  new_passwordParam : string,
  password_confirmationParam : string,
) => {
  return new Promise((resolve, reject) => {
    fetch("/api/getUsers", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "omit",
      body: JSON.stringify({
        action: actionParam,
        user_email: user_emailParam,
        user_password: user_passwordParam,
        new_password: new_passwordParam,
        password_confirmation: password_confirmationParam,
      }),
    })
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
};
