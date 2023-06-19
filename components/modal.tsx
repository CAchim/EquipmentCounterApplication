import Image from "next/image";

export interface ModalProps {
  title: string;
  description: string;
  pictureUrl: string;
  className: string;
}

const Modal = (props: ModalProps) => {
  return (
    <>
      <div className={props.className}>
        <p className="text-light fs-2">{props.title}</p>
        <Image
          src={props.pictureUrl}
          height={200}
          width={200}
          alt="modal image"
          className="img-fluid"
          priority
        ></Image>
        <p className="text-light fs-3">{props.description}</p>
      </div>
    </>
  );
};
export default Modal;
