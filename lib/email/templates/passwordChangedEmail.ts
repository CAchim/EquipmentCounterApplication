import { buildEmailShell, safeName } from "./_sharedEmail";

export interface PasswordChangedTemplateParams {
  firstName: string;
  email?: string;
  changedAt?: string;   // e.g. ISO string or formatted date/time
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Overloads:
 *  - passwordChangedTemplate("John")
 *  - passwordChangedTemplate({ firstName: "John", email: "...", ... })
 */
export function passwordChangedTemplate(firstName: string): string;
export function passwordChangedTemplate(
  params: PasswordChangedTemplateParams
): string;
export function passwordChangedTemplate(
  input: string | PasswordChangedTemplateParams
): string {
  let firstName: string;
  let email: string | undefined;
  let changedAt: string | undefined;
  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  if (typeof input === "string") {
    // Old usage: passwordChangedTemplate(firstName)
    firstName = input;
  } else {
    // New usage: passwordChangedTemplate({ ... })
    firstName = input.firstName;
    email = input.email;
    changedAt = input.changedAt;
    ipAddress = input.ipAddress;
    userAgent = input.userAgent;
  }

  const name = safeName(firstName);

  const metaRows: string[] = [];

  if (changedAt) {
    metaRows.push(`
      <tr>
        <th
          align="left"
          style="
            padding:4px 8px 4px 0;
            white-space:nowrap;
            font-weight:600;
            font-size:13px;
          "
        >
          Time
        </th>
        <td style="padding:4px 0;">${changedAt}</td>
      </tr>
    `);
  }

  if (email) {
    metaRows.push(`
      <tr>
        <th
          align="left"
          style="
            padding:4px 8px 4px 0;
            white-space:nowrap;
            font-weight:600;
            font-size:13px;
          "
        >
          Account
        </th>
        <td style="padding:4px 0;">${email}</td>
      </tr>
    `);
  }

  if (ipAddress) {
    metaRows.push(`
      <tr>
        <th
          align="left"
          style="
            padding:4px 8px 4px 0;
            white-space:nowrap;
            font-weight:600;
            font-size:13px;
          "
        >
          IP address
        </th>
        <td style="padding:4px 0;">${ipAddress}</td>
      </tr>
    `);
  }

  if (userAgent) {
    metaRows.push(`
      <tr>
        <th
          align="left"
          style="
            padding:4px 8px 4px 0;
            white-space:nowrap;
            font-weight:600;
            font-size:13px;
          "
        >
          Device / browser
        </th>
        <td style="padding:4px 0;">${userAgent}</td>
      </tr>
    `);
  }

  const metaTable =
    metaRows.length > 0
      ? `
    <div
      style="
        margin-top:10px;
        padding:14px 16px;
        border-radius:10px;
        background:#f5f7fb;
        border:1px solid #e0e0e0;
        font-size:14px;
        line-height:1.45;
        color:#150452;
      "
    >
      <table
        role="presentation"
        width="100%"
        style="
          border-collapse:collapse;
          border-spacing:0;
          font-size:14px;
          line-height:1.45;
          color:#150452;
        "
      >
        ${metaRows.join("")}
      </table>
    </div>
  `
      : "";

  const bodyHtml = `
    <h1
      style="
        font-size:18px;
        margin:0 0 12px 0;
        line-height:1.25;
        color:#150452;
      "
    >
      Your password has been changed
    </h1>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Hi ${name}, this is a confirmation that the password for your account
      in the <strong>Equipment Counter Application</strong> has been changed.
    </p>

    ${metaTable}

    <p
      style="
        font-size:13px;
        margin:16px 0 10px 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      If you made this change, no further action is required.
    </p>

    <p
      style="
        font-size:13px;
        margin:0 0 16px 0;
        line-height:1.45;
        color:#b91c1c;
      "
    >
      If you <strong>did not</strong> change your password, please contact your
      local admin or Counter Application administrator immediately.
    </p>
  `;

  const preheader = email
    ? `The password for ${email} was changed in the Counter Application.`
    : `The password for your Counter Application account was changed.`;

  return buildEmailShell({
    title: "Password changed",
    preheader,
    headerSubtitle: "Password changed confirmation",
    bodyHtml,
  });
}
