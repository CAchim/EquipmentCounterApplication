import Layout from "../components/layout";
import Head from "next/head";
import Table from "../components/table";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

const Home = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [triggerFetch, setTriggerFetch] = useState(false);

  //Set a fetch interval for new data - used for reloading data in production screen
  useEffect(() => {
    let intervalID = setInterval(() => {
      if (triggerFetch) {
        setTriggerFetch(false);
      } else {
        setTriggerFetch(true);
      }
    }, 10000);

    return () => {
      clearInterval(intervalID);
    };
  }, [triggerFetch]);

  if (session) {
    try {
      router.push("/editprojects");
    } catch (err) {}
    return null;
  }
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
