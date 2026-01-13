interface ResetPasswordTemplateParams {
  firstName?: string | null;
  otpCode: string;
  validMinutes: number;
  appName?: string;
}

export function buildResetPasswordOtpHtml(params: ResetPasswordTemplateParams): string {
  const { firstName, otpCode, validMinutes, appName = "Equipment Counter" } = params;

  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
      <p>${greeting}</p>
      <p>You requested to reset your password for <strong>${appName}</strong>.</p>
      <p>Your one-time verification code is:</p>
      <p style="
        font-size: 24px;
        letter-spacing: 4px;
        font-weight: bold;
        padding: 12px 16px;
        border-radius: 8px;
        background: #f5f5f5;
        display: inline-block;
      ">
        ${otpCode}
      </p>
      <p>This code is valid for <strong>${validMinutes} minutes</strong>.</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
      <br />
      <p>Best regards,</p>
      <p>The ${appName} Team</p>
    </div>
  `;
}

export function buildResetPasswordOtpText(params: ResetPasswordTemplateParams): string {
  const { firstName, otpCode, validMinutes, appName = "Equipment Counter" } = params;

  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return [
    greeting,
    "",
    `You requested to reset your password for ${appName}.`,
    "",
    "Your one-time verification code is:",
    otpCode,
    "",
    `This code is valid for ${validMinutes} minutes.`,
    "",
    "If you did not request a password reset, you can safely ignore this email.",
    "",
    "Best regards,",
    `The ${appName} Team`,
  ].join("\n");
}
