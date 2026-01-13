import React, { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import axios from "axios";
import Link from "next/link";
import styles from "../styles/Signin.module.scss";

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Send OTP
  const handleSendOTP = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await axios.post("/api/auth/request-otp", { email });
      setMessage(response.data.message);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await axios.post("/api/auth/verify-otp", { email, otp });
      setMessage(response.data.message);
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await axios.post("/api/auth/reset-password", {
        email,
        otp,
        newPassword,
      });
      setMessage(response.data.message);

      // Optional: reset form back to step 1 after success
      setStep(1);
      setEmail("");
      setOtp("");
      setNewPassword("");
      setShowNewPassword(false);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Forgot Password</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.card}>
          {/* Left Illustration */}
          <div className={styles.leftPanel}>
            <Image
              src="/undraw_forgot_password.svg"
              alt="Forgot Password"
              width={350}
              height={350}
              priority
            />
          </div>

          {/* Right Panel */}
          <div className={styles.rightPanel}>
            <h2 className={styles.title}>Forgot Password</h2>
            <p className={styles.subtitle}>
              {step === 1 && "Enter your email to receive a one-time OTP."}
              {step === 2 && "Enter the OTP sent to your email."}
              {step === 3 && "Enter your new password."}
            </p>

            {/* Step 1: Send OTP */}
            {step === 1 && (
              <>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.inputForgot}
                />
                <div className={styles.centerButton}>
                  <button
                    onClick={handleSendOTP}
                    disabled={loading || !email}
                    className={styles.button}
                  >
                    {loading ? "Sending..." : "Send OTP"}
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Verify OTP */}
            {step === 2 && (
              <>
                <input
                  type="text"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className={styles.inputForgot}
                />
                <div className={styles.centerButton}>
                  <button
                    onClick={handleVerifyOTP}
                    disabled={loading || otp.length !== 6}
                    className={styles.button}
                  >
                    {loading ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Set New Password */}
            {step === 3 && (
              <>
                <div className={styles.passwordWrapperForgot}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={styles.inputForgot}
                  />
                  <button
                    type="button"
                    className={styles.togglePasswordForgot}
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    <Image
                      src={showNewPassword ? "/eye-slash.svg" : "/eye.svg"}
                      alt="toggle password visibility"
                      width={20}
                      height={20}
                    />
                  </button>
                </div>

                <div className={styles.centerButton}>
                  <button
                    onClick={handleResetPassword}
                    disabled={loading || newPassword.length < 6}
                    className={styles.button}
                  >
                    {loading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </>
            )}            


            {/* Feedback messages */}
            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.success}>{message}</p>}

            {/* Back to Sign In */}
            <div className={styles.footerForgot}>
              <Link href="/signin" className={styles.forgot}>
                ← Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
