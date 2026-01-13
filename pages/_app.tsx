import "../styles/globals.scss";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { PlantProvider } from "../contexts/Plantcontext";
import Footer from "../components/footer";

function MyApp({ Component, pageProps }: any) {
  useEffect(() => {
    // @ts-ignore
    import("bootstrap/dist/js/bootstrap.bundle");
  }, []);

  return (
    <SessionProvider session={pageProps.session}>
      <PlantProvider>
        <LayoutWrapper Component={Component} pageProps={pageProps} />
      </PlantProvider>
    </SessionProvider>
  );
}

export default MyApp;

function LayoutWrapper({ Component, pageProps }: any) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const getLayout = Component.getLayout || ((page: any) => page);

  useEffect(() => {
    if (status !== "authenticated") return;

    const path = router.pathname.toLowerCase();
    const publicPaths = ["/signin", "/forgot-password"];
    if (publicPaths.includes(path)) return;

    const isOnChangePwPage =
      path === "/changepassword" || path === "/change-password";

    const user: any = session?.user;
    const mustChange =
      user?.mustChangePassword ?? (user?.must_change_password === 1);

    if (mustChange && !isOnChangePwPage) {
      router.replace("/changepassword?firstLogin=1");
    }
  }, [status, session, router]);

  // ✅ wrap with a shell so footer can stick to bottom
  return (
    <div className="app-shell">
      <main className="app-main">{getLayout(<Component {...pageProps} />)}</main>
      <Footer />
    </div>
  );
}
