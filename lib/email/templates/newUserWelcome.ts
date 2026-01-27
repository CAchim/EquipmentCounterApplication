import {
  safeName,
  getAppUrl,
  renderCtaButton,
  buildEmailShell,
} from "./_sharedEmail";

/**
 * Welcome email for a newly created user.
 * Signature kept compatible with your existing EmailSender imports.
 */
export function newUserWelcomeTemplate(
  firstName: string,
  email: string,
  tempPassword: string
): string {
  const name = safeName(firstName);
  const appUrl = getAppUrl();

  const bodyHtml = `
    <h1
      style="
        font-size:18px;
        margin:0 0 12px 0;
        line-height:1.25;
        color:#150452;
      "
    >
      Welcome to the Counter Application
    </h1>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Hi ${name}, your account for the
      <strong>Equipment Counter Application</strong>
      has been successfully created.
    </p>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Below you can find your login details and the link to access the tool:
    </p>

    <p
      style="
        font-size:14px;
        margin:16px 0 8px 0;
        line-height:1.45;
        font-weight:600;
        color:#150452;
      "
    >
      Account details
    </p>

    <!-- Info box: same style pattern as ownerChangedEmail.ts -->
    <div
      style="
        margin-top:8px;
        padding:14px 16px;
        border-radius:10px;
        background:#f5f7fb;
        border:1px solid #e0e0e0;
        font-size:14px;
        line-height:1.45;
        color:#150452;
      "
    >

      <div style="margin-bottom:6px;">
        <strong>Username:</strong>
        <span style="margin-left:4px;">${email}</span>
      </div>

      <div>
        <strong>Temporary password:</strong>
        <span style="margin-left:4px;">
          <span
            style="
              font-family:monospace;
              font-weight:600;
              padding:2px 6px;
              border-radius:6px;
              background:#111827;
              color:#f9fafb;
              display:inline-block;
            "
          >
            ${tempPassword}
          </span>
          <span
            style="
              display:inline-block;
              margin-left:8px;
              padding:2px 6px;
              border-radius:999px;
              background:#fde68a;
              color:#92400e;
              font-size:10px;
              font-weight:600;
              text-transform:uppercase;
              letter-spacing:0.03em;
            "
          >
            temporary
          </span>
        </span>
      </div>
    </div>

    <p
      style="
        font-size:14px;
        margin:18px 0 8px 0;
        line-height:1.45;
        font-weight:600;
        color:#150452;
      "
    >
      Next steps
    </p>

    <ol
      style="
        margin:0 0 12px 22px;
        padding:0;
        font-size:14px;
        line-height:1.5;
        color:#150452;
      "
    >
      <li>Open the Counter Application using the link above.</li>
      <li>Sign in with your username and the temporary password.</li>
      <li>You will be asked to change your password at first login.</li>
    </ol>

    <div
      style="
        text-align:center;
        margin-top:18px;
        margin-bottom:10px;
      "
    >
      ${renderCtaButton("Open Counter Application", appUrl)}
    </div>

    <p
      style="
        font-size:13px;
        margin:25px 0 0 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      For security reasons, please keep this email confidential and do not share your credentials.
    </p>

    <p
      style="
        font-size:12px;
        margin:0 0 16px 0;        
        line-height:1.45;
        color:#4b5563;
      "
    >
      If you did not expect this account, please contact your local admin
      or Counter Application administrator.
    </p>
  `;

  return buildEmailShell({
    title: "Welcome to the Counter Application",
    preheader:
      "Your account for the Equipment Counter Application has been created.",
    headerSubtitle: "Your Counter Application account is ready",
    bodyHtml,
  });
}
