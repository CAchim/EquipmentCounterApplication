import Head from "next/head";
import Navbar from "./navbar";
import Footer from "./footer";

export default function Layout({ session, children }: any) {
  return (
    <>
      <Head>
        <title>Line Counter</title>
        {/* 🔹 Important for proper scaling on phones */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Shell so we can control main area padding */}
      <div className="app-shell">
        {/* Fixed navbar at the top */}
        <div className="position-fixed top-0 w-100 bg-primary zIndex-2000 app-navbar">
          <Navbar />
        </div>

        {/* Main content with padding so it doesn't hide behind navbar/footer */}
        <main className="app-main">{children}</main>

        {/* Fixed footer at the bottom */}
        <div className="position-fixed bottom-0 w-100 bg-dark zIndex-2000 app-footer">
          <Footer />
        </div>
      </div>
    </>
  );
}
