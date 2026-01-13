export function newUserWelcomeTemplate(
  firstName: string,
  email: string,
  tempPassword: string
): string {
  const safeName =
    firstName && firstName.trim().length > 0 ? firstName.trim() : "there";

  // Prefer an env var, fall back to your current hardcoded URL
  const appUrl =
    process.env.APP_BASE_URL || "http://tm-fixture-counter";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your Counter Application Account</title>

    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Quicksand", system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        background-color: #f3f4f6;
        color: #150452;
      }

      .wrapper {
        width: 100%;
        padding: 1.5rem 0;
        box-sizing: border-box;
      }

      .customWidth {
        width: 95%;
        max-width: 860px;
        margin: 0 auto;
      }

      @media (min-width: 768px) {
        .customWidth {
          width: 75%;
        }
      }

      .card {
        background-color: #ffffff;
        border-radius: 12px;
        padding: 1.75rem 1.5rem 1.5rem 1.5rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
      }

      .header-bar {
        border-radius: 12px 12px 0 0;
        padding: 1rem 1.5rem;
        margin: -1.75rem -1.5rem 1.25rem -1.5rem;
        background: linear-gradient(
          90deg,
          rgba(62, 35, 155, 0.85) 0%,
          rgba(226, 0, 22, 0.85) 15%,
          rgba(255, 0, 0, 0.85) 25%,
          rgba(255, 76, 0, 0.85) 35%,
          rgba(255, 103, 0, 0.85) 45%,
          rgba(255, 149, 0, 0.85) 55%,
          rgba(255, 178, 0, 0.85) 65%,
          rgba(255, 140, 0, 0.85) 75%,
          rgba(255, 63, 0, 0.85) 85%,
          rgba(255, 31, 0, 0.85) 100%
        );
        color: #fff;
        box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.05);
      }

      .header-title {
        font-size: 1.2rem;
        font-weight: 600;
        margin: 0;
      }

      .header-subtitle {
        font-size: 0.9rem;
        margin: 0.25rem 0 0 0;
        opacity: 0.9;
      }

      .section-title {
        font-size: 1rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
        color: #150452;
      }

      .credentials-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.75rem 0 1.25rem 0;
        font-size: 0.95rem;
      }

      .credentials-table th,
      .credentials-table td {
        padding: 0.4rem 0;
        text-align: left;
      }

      .credentials-table th {
        width: 35%;
        font-weight: 500;
        opacity: 0.85;
      }

      .badge-temp {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        border-radius: 10px;
        background: #fef3c7;
        color: #b45309;
        font-size: 0.75rem;
        font-weight: 600;
        margin-left: 0.35rem;
      }

      .primary-link {
        color: #ff4c00;
        font-weight: 700;
        text-decoration: none;
      }

      .primary-link:hover {
        text-decoration: underline;
      }

      .info-box {
        margin-top: 0.5rem;
        font-size: 0.9rem;
        color: #4b5563;
      }

      .footer {
        margin: 1rem -1.5rem -1.5rem -1.5rem;
        padding: 0.4rem 1.5rem;
        font-size: 0.75rem;
        background: linear-gradient(
          90deg,
          rgba(62, 35, 155, 0.85) 0%,
          rgba(226, 0, 22, 0.85) 15%,
          rgba(255, 0, 0, 0.85) 25%,
          rgba(255, 76, 0, 0.85) 35%,
          rgba(255, 103, 0, 0.85) 45%,
          rgba(255, 149, 0, 0.85) 55%,
          rgba(255, 178, 0, 0.85) 65%,
          rgba(255, 140, 0, 0.85) 75%,
          rgba(255, 63, 0, 0.85) 85%,
          rgba(255, 31, 0, 0.85) 100%
        );
        color: #fff;
        border-radius: 0 0 12px 12px;
        text-align: center;
      }
    </style>
  </head>

  <body>
    <div class="wrapper">
      <div class="customWidth">
        <div class="card">
          <div class="header-bar">
            <p class="header-title">Counter Application</p>
            <p class="header-subtitle">Welcome to the spare parts & probes manager</p>
          </div>

          <h1 style="font-size: 1.1rem; margin: 0 0 0.75rem 0;">
            Hello ${safeName},
          </h1>

          <p style="font-size: 0.95rem; margin: 0 0 0.75rem 0;">
            Your account for the <strong>Equipment Counter Application</strong>
            has been successfully created.
          </p>

          <p style="font-size: 0.95rem; margin: 0 0 0.75rem 0;">
            Below you can find your login credentials and the link to access the tool:
          </p>

          <p class="section-title">Account details</p>

          <table class="credentials-table" role="presentation">
            <tr>
              <th>Application link</th>
              <td>
                <a href="${appUrl}" class="primary-link" target="_blank" rel="noopener noreferrer">
                  ${appUrl}
                </a>
              </td>
            </tr>
            <tr>
              <th>Username</th>
              <td>${email}</td>
            </tr>
            <tr>
              <th>Temporary password</th>
              <td>
                <span style="font-family: monospace; font-weight: 600;">
                  ${tempPassword}
                </span>
                <span class="badge-temp">temporary</span>
              </td>
            </tr>
          </table>

          <div class="info-box">
            When you log in for the first time, you will be asked to change
            this temporary password and set your own secure password.
          </div>

          <p style="font-size: 0.9rem; margin-top: 1rem;">
            If you did not expect this account, please contact your
            local admin or Counter Application administrator.
          </p>

          <div class="footer">
            &copy;&nbsp;Aumovio Romania&nbsp;- Counter Application
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
