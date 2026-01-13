interface ProjectDeletedTemplateParams {
  firstName: string;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  warningAt?: number | null;
  limit?: number | null;
  deletedBy: string;
}

export function projectDeletedTemplate(
  params: ProjectDeletedTemplateParams
): string {
  const {
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    warningAt,
    limit,
    deletedBy,
  } = params;

  const safeName =
    firstName && firstName.trim().length > 0 ? firstName.trim() : "there";

  const appUrl = process.env.APP_BASE_URL || "http://tm-fixture-counter/";

  // Safely format warning / limit
  const safeWarning =
    typeof warningAt === "number" && !isNaN(warningAt) ? warningAt : "-";
  const safeLimit =
    typeof limit === "number" && !isNaN(limit) ? limit : "-";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Project Deleted</title>

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
        background-color: #3e239b; /* fallback */
        background-image: linear-gradient(
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

      .info-box {
        margin-top: 0.75rem;
        padding: 0.9rem 1.1rem;
        border-radius: 10px;
        background: #f5f7fb;
        border: 1px solid #e0e0e0;
        font-size: 0.9rem;
      }

      .table-wrapper {
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid #ddd;
        display: inline-block;
        margin-top: 0.75rem;
      }

      table {
        border-collapse: collapse;
        font-size: 0.9rem;
        width: 100%;
      }

      th,
      td {
        border: 1px solid #ddd;
        padding: 6px 10px;
        text-align: left;
      }

      th {
        background: #f0f0f5;
        font-weight: 600;
      }

      .row-label {
        font-weight: 600;
      }

      .button-link {
        display: inline-block;
        margin-top: 1rem;
        margin-bottom: 1.5rem;
        padding: 0.7rem 1.4rem;
        border-radius: 10px;
        text-decoration: none;
        font-weight: 600;
        font-size: 0.9rem;
        background: #ff4000;
        color: #ffffff;
      }

      .footer {
        margin: 1rem -1.5rem -1.5rem -1.5rem;
        padding: 0.4rem 1.5rem;
        font-size: 0.75rem;
        background-color: #3e239b; /* fallback */
        background-image: linear-gradient(
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
            <p class="header-subtitle">Fixture / project removed</p>
          </div>

          <h1 style="font-size: 1.1rem; margin: 0 0 0.75rem 0;">
            Hello ${safeName},
          </h1>

          <p style="font-size: 0.95rem; margin: 0 0 0.75rem 0;">
            The following project has been <strong>deleted from the Counter Application</strong>:
          </p>

          <div class="info-box">
            <div><strong>Project:</strong> ${projectName}</div>
            <div>
              <strong>Adapter code:</strong> ${adapterCode}
              &nbsp;|&nbsp;
              <strong>Fixture type:</strong> ${fixtureType}
            </div>
            <div><strong>Plant:</strong> ${fixturePlant}</div>
          </div>

          <p style="font-size: 0.95rem; margin-top: 0.9rem;">
            These were the last saved limits for this fixture:
          </p>

          <div><strong>Contacts limit value:</strong> ${safeLimit}</div>
          <div><strong>Warning limit value:</strong> ${safeWarning}</div>

          <p style="font-size: 0.9rem; margin-top: 1rem;">
            This deletion was performed by:
            <strong>${deletedBy}</strong>.
          </p>

          <p style="font-size: 0.9rem; margin-top: 0.5rem;">
            If you believe this action was made in error, please contact your local admin or Counter Application administrator.
          </p>

          <div style="text-align: center; margin-top: 1.4rem;">
            <a href="${appUrl}" target="_blank" class="button-link" style="text-align:center;">
              Open Counter Application
            </a>
          </div>

          <div class="footer">
            &copy;&nbsp;Aumovio Romania&nbsp;- Counter Application
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
