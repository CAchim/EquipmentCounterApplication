import {
  buildEmailShell,
  getAppUrl,
  renderCtaButton,
  safeName,
} from "./_sharedEmail";

/**
 * HTML version of the reset-password OTP email.
 * Keeps the same signature you had before.
 */
export function buildResetPasswordOtpHtml(
  userFirstName: string | null | undefined,
  otp: string,
  validMinutes: number = 10,
  appUrl?: string
): string {
  const name = safeName(userFirstName ?? undefined);
  const baseUrl = appUrl && appUrl.trim().length > 0 ? appUrl : getAppUrl();

  const bodyHtml = `
    <h1
      style="
        font-size:18px;
        margin:0 0 12px 0;
        line-height:1.25;
        color:#150452;
      "
    >
      Password reset verification code
    </h1>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Hi ${name}, we received a request to reset the password for your account
      in the <strong>Equipment Counter Application</strong>.
    </p>

    <p
      style="
        font-size:14px;
        margin:0 0 8px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Use the following one-time password (OTP) to confirm this action:
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
      This code is valid for approximately <strong>${validMinutes} minutes</strong>.
      If it expires, you will need to request a new password reset.
    </p>

    <p
      style="
        font-size:13px;
        margin:0 0 14px 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      If you did <strong>not</strong> request a password reset, you can ignore this email.
      Your existing password will remain unchanged.
    </p>

    <div
      style="
        text-align:center;
        margin-top:18px;
        margin-bottom:10px;
      "
    >
      ${renderCtaButton("Open Counter Application", baseUrl)}
    </div>
  `;

  return buildEmailShell({
    title: "Password reset verification code",
    preheader: `Your reset password OTP code is ${otp} (valid ~${validMinutes} minutes)`,
    headerSubtitle: "Password reset verification",
    bodyHtml,
  });
}

/**
 * Plain-text fallback – kept almost identical to your previous version.
 */
export function buildResetPasswordOtpText(
  userFirstName: string | null | undefined,
  otp: string,
  validMinutes: number = 10,
  appUrl?: string
): string {
  const name = userFirstName && userFirstName.trim().length > 0
    ? userFirstName.trim()
    : "there";

  const baseUrl = appUrl && appUrl.trim().length > 0 ? appUrl : getAppUrl();

  return [
    `Hi ${name},`,
    "",
    "We received a request to reset the password for your account in the Equipment Counter Application.",
    "",
    `Your one-time password (OTP) is: ${otp}`,
    "",
    `This code is valid for about ${validMinutes} minutes. If it expires, please request a new password reset.`,
    "",
    `You can access the application here: ${baseUrl}`,
    "",
    "If you did not request this reset, you can ignore this email.",
  ].join("\n");
}
