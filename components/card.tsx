import Image from "next/image";

export type CardProperties = {
  displayText: string;
  picturePath: string;
  pictureHeight: number;
  pictureWidth: number;
};

const Card = ({
  displayText,
  picturePath,
  pictureHeight,
  pictureWidth,
}: CardProperties) => {
  return (
    <>
      <p className="display-3">{displayText}</p>
      <Image
        src={picturePath}
        height={pictureHeight}
        width={pictureWidth}
        alt="card"
        className="img-fluid"
        priority
      ></Image>
    </>
  );
};

export default Card;
