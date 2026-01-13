const Footer = () => {
  const currentDate:Date = new Date(); 

  return (
    <footer>
      <p className="text-light text-center m-0 p-2">
        &copy;&nbsp;Aumovio Romania&nbsp;- {currentDate.getFullYear()}
      </p>
    </footer>
  );
};
export default Footer;
