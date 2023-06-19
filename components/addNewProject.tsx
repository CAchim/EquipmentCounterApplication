import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const AddNewProject = (props: any) => {
  const { data: session, status } = useSession();
  const isMounted = useRef(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState<any>(false);

  const handleInsertButton = (e: any) => {
    e.preventDefault();

    const user: string = String(session?.user?.email || session?.user?.name);

    makeDatabaseAction(
      "insertProject",
      String(e.target.project_name.value),
      String(e.target.adapter_code.value),
      String(e.target.fixture_type.value),
      String(e.target.owner_email.value),
      parseInt(e.target.contacts_limit.value),
      parseInt(e.target.warning_at.value),
      user
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
              "Please insert the limit higher than the warning!";
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
              description: "Project has been successfully created!",
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
              name="project_name"
              type="text"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Project name"
              aria-label="Project"
              required
            ></input>
            <input
              name="adapter_code"
              type="text"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Adapter code"
              aria-label="Adapter"
              required
            ></input>
            <input
              name="fixture_type"
              type="text"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Fixture type"
              aria-label="Fixture type"
              required
            ></input>
            <input
              name="owner_email"
              type="email"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Owner email"
              aria-label="Owner"
              required
            ></input>
            <input
              name="contacts_limit"
              type="number"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Limit"
              aria-label="Limit"
              required
            ></input>
            <input
              name="warning_at"
              type="number"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Warning"
              aria-label="Warning"
              required
            ></input>
            <button
              type="submit"
              className="btn btn-primary fs-4 fw-bold text-nowrap col mb-3 scaleEffect"
            >
              Create!
            </button>
          </form>
        </div>
      </>
    );
};
export default AddNewProject;

const makeDatabaseAction = (
  actionParam: string,
  project_nameParam: string,
  adapter_codeParam: string,
  fixture_typeParam: string,
  owner_emailParam: string,
  contacts_limitParam: number,
  warning_atParam: number,
  modified_byParam: string
) => {
  return new Promise((resolve, reject) => {
    fetch("/api/getCounterInfo", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "omit",
      body: JSON.stringify({
        action: actionParam,
        project_name: project_nameParam,
        adapter_code: adapter_codeParam,
        fixture_type: fixture_typeParam,
        owner_email: owner_emailParam,
        contacts_limit: contacts_limitParam,
        warning_at: warning_atParam,
        modified_by: modified_byParam,
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
