import Layout from "../components/layout";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import AddNewProject from "../components/addNewProject";
import { useState, useRef, useEffect } from "react";
import Modal, { ModalProps } from "../components/modal";
import Image from "next/image";
import confirmNOK from "../public/undraw_cancel_u-1-it.svg";
import confirmOK from "../public/confirm_OK.svg";

const CreateProject = () => {
  const { status, data: session } = useSession();
  const router = useRouter();

  const modalElement = useRef<HTMLDivElement | null>(null);
  const closeModalBtn = useRef<HTMLButtonElement | null>(null);
  const parentModalElement = useRef<HTMLDivElement | null>(null);

  const [modalProps, setModalProps] = useState<ModalProps>({
    title: "",
    description: "",
    pictureUrl: confirmOK,
    className: "",
  });

  const isAdmin = session?.user?.user_group === "admin";
  const isIE = session?.user?.user_group === "engineer";

  const openModal = (parameters: ModalProps) => {
    if (modalElement.current && parentModalElement.current) {
      if (parameters.title === "Error!") {
        modalElement.current.classList.remove("bg-danger", "bg-success", "bg-warning");
        modalElement.current.classList.add("bg-danger");
      } else if (parameters.title === "Success!") {
        modalElement.current.classList.remove("bg-danger", "bg-success", "bg-warning");
        modalElement.current.classList.add("bg-success");
      }

      parentModalElement.current.classList.remove("d-none");
      modalElement.current.classList.remove("animate__bounceOut", "d-none");
      modalElement.current.classList.add("animate__bounceIn");
    }
    setModalProps(parameters);
    closeModalBtn.current?.focus();
  };

  const closeModal = () => {
    if (modalElement.current && parentModalElement.current) {
      modalElement.current.classList.remove("animate__bounceIn");
      modalElement.current.classList.add("animate__bounceOut");
      setTimeout(() => {
        modalElement.current?.classList.add("d-none");
        parentModalElement.current?.classList.add("d-none");
      }, 650);
    }
  };

  if (status === "authenticated") {
    // Only admin or IE can access this page
    if (isAdmin || isIE)
      return (
        <>
          <Head>
            <title>Create project</title>
          </Head>

          <div className="d-flex flex-column justify-content-center align-items-center position-relative top-0 start-0 w-100 screen-100 bg-light paddingTopBottom m-auto">
            <Image
              src="/create_project.svg"
              width={600}
              height={300}
              priority
              alt="createProject"
              className="img-fluid"
            />

            {/* The plant dropdown now lives inside AddNewProject (admin-only there).
                We pass only the modal handler here. */}
            <div className="w-100">
              <AddNewProject openModalAction={openModal} />
            </div>
          </div>

          {/* Modal Container */}
          <div className="d-none" ref={parentModalElement}>
            <div className="position-fixed start-50 top-50 translate-middle w-100 h-100 blurBg d-flex justify-content-center zIndex-2000">
              <div
                className="animate__animated d-none rounded-pill p-5 d-flex flex-column justify-content-center w-50 my-auto paddingModal"
                ref={modalElement}
              >
                <Modal
                  title={modalProps.title}
                  description={modalProps.description}
                  pictureUrl={modalProps.pictureUrl}
                  className={modalProps.className}
                />

                <div className="d-flex flex-column justify-content-around">
                  <button
                    ref={closeModalBtn}
                    className="btn btn-danger fs-3 m-auto fw-bold scaleEffect"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            <Image
              src={confirmNOK}
              className=""
              width={10}
              height={10}
              priority
              alt="confirmation NOK"
            />
          </div>
        </>
      );

    // Not allowed (logged-in but not admin/IE)
    return <h1>You are not allowed to access this section!</h1>;
  } else if (status === "loading") {
    return (
      <>
        <Head>
          <title>Loading...</title>
        </Head>
        <div className="d-flex flex-column align-items-center justify-content-center screen-100 paddingTopBottom">
          <div className="d-flex justify-content-center">
            <div
              className="spinner-grow text-primary"
              style={{ width: "10rem", height: "10rem" }}
              role="status"
            >
              <span className=""></span>
            </div>
          </div>
          <div className="d-flex justify-content-center p-5">
            <p className="text-white display-5">Loading data...</p>
          </div>
        </div>
      </>
    );
  } else {
    try {
      router.push("/signin");
    } catch (_err) {}
    return null;
  }
};

export default CreateProject;

CreateProject.getLayout = function getLayout(page: any) {
  return <Layout>{page}</Layout>;
};
