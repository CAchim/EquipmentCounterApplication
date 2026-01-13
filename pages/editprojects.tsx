import Head from "next/head";
import Layout from "../components/layout";
import Table from "../components/table";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import Modal, { ModalProps } from "../components/modal";
import confirmNOK from "../public/undraw_cancel_u-1-it.svg";
import confirmOK from "../public/confirm_OK.svg";
import Image from "next/image";

const EditProjects = () => {
  const { status } = useSession();
  const router = useRouter();

  const modalElement = useRef<HTMLDivElement>(null);
  const parentModalElement = useRef<HTMLDivElement>(null);
  const closeModalBtn = useRef<HTMLButtonElement>(null);

  const [modalProps, setModalProps] = useState<ModalProps>({
    title: "",
    description: "",
    pictureUrl: confirmOK.src,
    className: "",
  });

  // Redirect unauthenticated users to /signin (in effect to avoid abort warnings)
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  const openModal = (parameters: ModalProps) => {
    setModalProps(parameters);

    if (modalElement.current && parentModalElement.current) {
      // clear any existing bg classes
      modalElement.current.classList.remove(
        "bg-danger",
        "bg-success",
        "bg-warning",
        "bg-info"
      );

      // apply new bg class
      if (parameters.title === "Error!") {
        modalElement.current.classList.add("bg-danger");
      } else if (parameters.title === "Success!") {
        modalElement.current.classList.add("bg-success");
      } else if (parameters.title === "Project description") {
        modalElement.current.classList.add("bg-info");
      }

      // show modal
      parentModalElement.current.classList.remove("d-none");
      modalElement.current.classList.remove("d-none", "animate__bounceOut");
      modalElement.current.classList.add("animate__bounceIn");
      closeModalBtn.current?.focus();
    }
  };

  const closeModal = () => {
    if (modalElement.current && parentModalElement.current) {
      modalElement.current.classList.remove("animate__bounceIn");
      modalElement.current.classList.add("animate__bounceOut");

      setTimeout(() => {
        parentModalElement.current?.classList.add("d-none");
        modalElement.current?.classList.add("d-none");
      }, 650);
    }
  };

  // Loading state
  if (status === "loading") {
    return (
      <>
        <Head>
          <title>Loading...</title>
        </Head>
        <div className="d-flex flex-column align-items-center justify-content-center screen-100 paddingTopBottom">
          <div
            className="spinner-grow text-primary"
            style={{ width: "10rem", height: "10rem" }}
            role="status"
          >
            <span />
          </div>
          <p className="text-white display-5 mt-4">Loading data...</p>
        </div>
      </>
    );
  }

  // Unauthenticated: effect will navigate; render nothing to avoid render-time push
  if (status === "unauthenticated") {
    return null;
  }

  // Authenticated view
  return (
    <>
      <Head>
        <title>Edit projects</title>
      </Head>

      <div className="paddingTopBottom">
        <Table openModalAction={openModal} />
      </div>

      {/* Modal */}
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
            <button
              ref={closeModalBtn}
              className="btn btn-primary fs-3 m-auto fw-bold scaleEffect"
              onClick={closeModal}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Hidden confirm image (preload) */}
      <Image
        src={confirmNOK}
        width={10}
        height={10}
        priority
        alt="confirmation NOK"
        className="d-none"
      />
    </>
  );
};

export default EditProjects;

EditProjects.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};
