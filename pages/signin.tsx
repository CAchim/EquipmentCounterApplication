import { getProviders, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import styles from "../styles/Signin.module.scss";

export default function SignInNew({ providers }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 👁 Password visibility state
  const [showPassword, setShowPassword] = useState(false);

  const { data: session } = useSession();
  const router = useRouter();

  // 🔹 Auto-redirect if session exists
  useEffect(() => {
    if (session) router.push("/");
  }, [session, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false, // 🔹 Prevent automatic redirect
    });

    if (result?.error) {
      setErrorMessage("Invalid email or password. Please try again.");
    } else {
      window.location.href = "/"; // 🔹 Redirect manually if successful
    }

    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>AUMOVIO | Sign In</title>
      </Head>

      {/* 🔹 Top Notification */}
      {errorMessage && (
        <div className={styles.topError}>
          <div className={styles.errorContent}>
            <Image
              src="/wrong_password.svg"
              alt="Error"
              width={24}
              height={24}
              className={styles.errorIcon}
            />
            <p>{errorMessage}</p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={() => setErrorMessage("")}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles.card}>
          {/* Left illustration */}
          <div className={styles.illustration}>
            <Image
              src="/undraw_authentication_fsn5.svg"
              alt="Authentication"
              width={300}
              height={300}
              priority
            />
          </div>

          {/* Sign-in form */}
          <div className={styles.formSection}>
            <h2 className={styles.title}>Welcome Back!</h2>

            <form onSubmit={handleSignIn} className={styles.form}>
              {/* Email field */}
              <div className="mb-3">
                <label htmlFor="email" className={styles.label}>
                  Email or User ID
                </label>
                <input
                  type="text"
                  id="identifier"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="Enter your email or user ID"
                  required
                />
              </div>

              {/* Password field with eye icon */}
              <div className="mb-3">
                <label className={styles.label}>Password</label>

                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${styles.input} ${styles.passwordInput}`}
                    placeholder="Enter your password"
                    required
                  />

                  <button
                    type="button"
                    className={styles.eyeButton}
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                  >
                    <Image
                      src={showPassword ? "/eye-slash.svg" : "/eye.svg"}
                      alt={showPassword ? "Hide password" : "Show password"}
                      width={22}
                      height={22}
                    />
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className={styles.options}>
                <div className={styles.checkboxWrapper}>
                  <input type="checkbox" id="remember" />
                  <label htmlFor="remember">Remember me</label>
                </div>
                <Link href="/forgot-password" className={styles.forgot}>
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                className={styles.signinBtn}
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* Back to Home button */}
            <div className="text-center mt-3">
              <Link href="/" className={styles.backHomeBtn}>
                ⬅ Back to Home
              </Link>
            </div>

            {/* Divider */}
            {/*<div className={styles.divider}>
              <span>or continue with</span>
            </div>*/} 

            {/* OAuth providers */}
            <div className={styles.providers}>
              {Object.values(providers).map((provider: any) => {
                if (provider.name === "Credentials") return null;
                return (
                  <button
                    key={provider.name}
                    onClick={() => signIn(provider.id)}
                    className={styles.providerBtn}
                  >
                    Sign in with {provider.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps() {
  const providers = await getProviders();
  return { props: { providers } };
}
