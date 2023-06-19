import React, { useState } from "react";
import axios from "axios";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [otp, setOTP] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = async () => {
    try {
      const response = await axios.post("https://your-api.com/forgot-password", { email });
      if (response.status === 200) {
        setOtpSent(true);
        // Display a message to user indicating the OTP has been sent
      } else {
        // Handle failure (e.g., show an error message)
      }
    } catch (error) {
      // Handle error
    }
  };

  const handleResetPassword = async () => {
    try {
      const response = await axios.post("https://your-api.com/reset-password", { email, otp, newPassword });
      if (response.status === 200) {
        // Handle success (e.g., show a success message and redirect to login)
      } else {
        // Handle failure (e.g., show an error message)
      }
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
      />
      {!otpSent ? (
        <button onClick={handleSendOTP}>Send OTP</button>
      ) : (
        <>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOTP(e.target.value)}
            placeholder="Enter the OTP"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
          <button onClick={handleResetPassword}>Reset Password</button>
        </>
      )}
    </div>
  );
};

export default ForgotPassword;
