import Layout from "../components/layout";
import Head from "next/head";
import Table from "../components/table";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

const Home = () => {
  const { status } = useSession();
  const router = useRouter();
  const [triggerFetch, setTriggerFetch] = useState(false);

  // Redirect authenticated users to /editprojects (do this in an effect)
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/editprojects");
    }
  }, [status, router]);

  // Public auto-refresh only when NOT authenticated (otherwise we’re redirecting)
  useEffect(() => {
    if (status === "authenticated") return; // skip interval while redirecting
    const intervalID = setInterval(() => {
      setTriggerFetch((prev) => !prev);
    }, 10000);
    return () => clearInterval(intervalID);
  }, [status]);

  // While deciding auth or performing redirect, render a tiny placeholder
  if (status === "loading" || status === "authenticated") {
    return (
      <>
        <Head>
          <title>Fixture Counter</title>
        </Head>
        <div className="paddingTopBottom text-center">Loading…</div>
      </>
    );
  }

  // Unauthenticated: show the public table (Show All)
  return (
    <>
      <Head>
        <title>Fixture Counter</title>
      </Head>

      <div className="paddingTopBottom">
        <Table triggerFetchProp={triggerFetch} mode={"view"} />
      </div>
    </>
  );
};

export default Home;

Home.getLayout = function getLayout(page: any) {
  return <Layout>{page}</Layout>;
};
