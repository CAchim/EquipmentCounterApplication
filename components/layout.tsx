import Head from "next/head";
import Navbar from "./navbar";
import Footer from "./footer";

export default function Layout({ session, children }: any) {
  return (
    <>
      <Head>
        <title>Line Counter</title>
      </Head>

      <main>{children}</main>

      <div className="position-fixed top-0 w-100 bg-primary zIndex-2000">
        <Navbar />
      </div>

      <div className="position-fixed bottom-0 w-100 bg-dark zIndex-2000">
        <Footer />
      </div>
    </>
  );
}
