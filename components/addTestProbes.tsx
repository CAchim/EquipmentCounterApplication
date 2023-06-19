import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const AddTestProbes = (props: any) => {
  const { data: session, status } = useSession();
  const isMounted = useRef(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState<any>(false);

  const handleInsertButton = (e: any) => {
    e.preventDefault();

    const user: string = String(session?.user?.email || session?.user?.name);

    makeDatabaseAction(
      "concatenateNails",
      String(e.target.adapter_code.value),
      String(e.target.fixture_type.value),
      user,
      String(e.target.part_number1.value),
      parseInt(e.target.quantity1.value),
      String(e.target.part_number2.value),
      parseInt(e.target.quantity2.value),
      String(e.target.part_number3.value),
      parseInt(e.target.quantity3.value),
      String(e.target.part_number4.value),
      parseInt(e.target.quantity4.value),
      String(e.target.part_number5.value),
      parseInt(e.target.quantity5.value),
      String(e.target.part_number6.value),
      parseInt(e.target.quantity6.value),
      String(e.target.part_number7.value),
      parseInt(e.target.quantity7.value),
      String(e.target.part_number8.value),
      parseInt(e.target.quantity8.value),
      String(e.target.part_number9.value),
      parseInt(e.target.quantity9.value),
      String(e.target.part_number10.value),
      parseInt(e.target.quantity10.value)
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
              "The specified PN already exists!";
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
              description: "Test probes have been successfully addeded!",
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
              name="adapter_code"
              type="text"
              className="form-control createProjectBarSize fw-bolder col mb-3"
              placeholder="Adapter code"
              aria-label="Adapter code"
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
            <div className="float-container col mb-3">
              <div className="float-child1 col mb-1">
                <div className="green">Part number</div>
                <input
                  name="part_number1"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="First PN"
                  required
                ></input>
                <input
                  name="part_number2"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Second PN"
                ></input>
                <input
                  name="part_number3"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Third PN"
                ></input>
                <input
                  name="part_number4"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Fourth PN"
                ></input>
                <input
                  name="part_number5"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Fifth PN"
                ></input>
                <input
                  name="part_number6"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Sixth PN"
                ></input>
                <input
                  name="part_number7"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Seventh PN"
                ></input>
                <input
                  name="part_number8"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Eigth PN"
                ></input>    
                <input
                  name="part_number9"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Nineth PN"
                ></input> 
                <input
                  name="part_number10"
                  type="text"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="PN"
                  aria-label="Tenth PN"
                ></input>             
            </div>
            <div className="float-child2 col mb-1">
              <div className="green">Quantity</div>
                <input
                  name="quantity1"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity1"
                  required
                ></input>
                <input
                  name="quantity2"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity2"
                ></input>
                <input
                  name="quantity3"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity3"
                ></input>
                <input
                  name="quantity4"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity4"
                ></input>
                <input
                  name="quantity5"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity5"
                ></input>
                <input
                  name="quantity6"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity6"
                ></input>
                <input
                  name="quantity7"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity7"
                ></input>  
                <input
                  name="quantity8"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity8"
                ></input>
                <input
                  name="quantity9"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity9"
                ></input> 
                <input
                  name="quantity10"
                  type="number"
                  className="form-control createProjectBarSize fw-bolder col mb-1"
                  placeholder="0"
                  aria-label="quantity10"
                ></input>            
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary fs-4 fw-bold text-nowrap col mb-3 scaleEffect"
            >
              Add
            </button>
          </form>
        </div>
        

      </>
    );
};
export default AddTestProbes; 
const makeDatabaseAction = (
  actionParam: string,
  adapter_codeParam: string,
  fixture_typeParam: string,
  modified_byParam: string,
  part_number1Param: string,
  quantity1Param: number,
  part_number2Param: string,
  quantity2Param: number,
  part_number3Param: string,
  quantity3Param: number,
  part_number4Param: string,
  quantity4Param: number,
  part_number5Param: string,
  quantity5Param: number,
  part_number6Param: string,
  quantity6Param: number,
  part_number7Param: string,
  quantity7Param: number,
  part_number8Param: string,
  quantity8Param: number,
  part_number9Param: string,
  quantity9Param: number,
  part_number10Param: string,
  quantity10Param: number,
) => {
  return new Promise((resolve, reject) => {
    fetch("/api/getCounterInfo", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "omit",
      body: JSON.stringify({
        action: actionParam,
        adapter_code: adapter_codeParam,
        fixture_type: fixture_typeParam,
        modified_by: modified_byParam,
        part_number1: part_number1Param, 
        quantity1: quantity1Param, 
        part_number2: part_number2Param, 
        quantity2: quantity2Param, 
        part_number3: part_number3Param, 
        quantity3: quantity3Param, 
        part_number4: part_number4Param, 
        quantity4: quantity4Param, 
        part_number5: part_number5Param, 
        quantity5: quantity5Param, 
        part_number6: part_number6Param, 
        quantity6: quantity6Param, 
        part_number7: part_number7Param, 
        quantity7: quantity7Param, 
        part_number8: part_number8Param, 
        quantity8: quantity8Param, 
        part_number9: part_number9Param, 
        quantity9: quantity9Param, 
        part_number10: part_number10Param, 
        quantity10: quantity10Param,
        
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
