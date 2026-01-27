import { buildEmailShell } from "./_sharedEmail";

export function otpEmailTemplate(otp: string): string {
  const bodyHtml = `
    <h1
      style="
        font-size:18px;
        margin:0 0 12px 0;
        line-height:1.25;
        color:#150452;
      "
    >
      One-time password (OTP) for verification
    </h1>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Below is your one-time password (OTP). Use it to complete your verification
      in the Counter Application.
    </p>

    <p
      style="
        font-size:14px;
        margin:0 0 8px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      <strong>Your OTP code:</strong>
    </p>

    <p
      style="
        margin:0 0 12px 0;
      "
    >
      <span
        style="
          display:inline-block;
          font-family:monospace;
          font-size:18px;
          font-weight:700;
          letter-spacing:0.16em;
          padding:6px 12px;
          border-radius:8px;
          background:#111827;
          color:#f9fafb;
        "
      >
        ${otp}
      </span>
    </p>

    <p
      style="
        font-size:13px;
        margin:0 0 10px 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      This code is valid for a limited time and can be used only once.
      If you did not request this code, you can safely ignore this email.
    </p>
  `;

  return buildEmailShell({
    title: "Counter Application - OTP Code",
    preheader: `Your one-time password for Counter Application is ${otp}`,
    headerSubtitle: "One-time password for verification",
    bodyHtml,
  });
}
