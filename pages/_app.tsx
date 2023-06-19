import "../styles/globals.scss";
import { SessionProvider } from "next-auth/react";


function MyApp({ Component, pageProps }: any) {

  return (
    <SessionProvider session={pageProps.session}>
        <LayoutWrapper Component={Component} pageProps={pageProps} />
    </SessionProvider>
  );
}
export default MyApp;

function LayoutWrapper({ Component, pageProps }: any) {
  const getLayout = Component.getLayout || ((page: any) => page);
  return getLayout(<Component {...pageProps} />);
}
