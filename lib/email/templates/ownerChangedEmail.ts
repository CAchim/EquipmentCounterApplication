interface OwnerAssignedParams {
  firstName: string;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  oldOwnerEmail: string;
}

interface OwnerRemovedParams {
  firstName: string;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  newOwnerEmail: string;
}

/**
 * Template for the NEW owner ("you are now responsible...")
 */
export function ownerChangedTemplate(params: OwnerAssignedParams): string {
  const {
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    oldOwnerEmail,
  } = params;

  const safeName =
    firstName && firstName.trim().length > 0 ? firstName.trim() : "there";

  const appUrl = process.env.APP_BASE_URL || "http://tm-fixture-counter/";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Owner Assigned</title>

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
            <p class="header-subtitle">New owner assigned to a fixture</p>
          </div>

          <h1 style="font-size: 1.1rem; margin: 0 0 0.75rem 0;">
            You are now the owner
          </h1>

          <p style="font-size: 0.95rem; margin: 0 0 0.75rem 0;">
            Hi ${safeName}, you have been assigned as the
            <strong>owner</strong> of the following project fixture in the
            <strong>Equipment Counter Application</strong>:
          </p>

          <div class="info-box">
            <div><strong>Project:</strong> ${projectName}</div>
            <div>
              <strong>Adapter code:</strong> ${adapterCode}
              &nbsp;|&nbsp;
              <strong>Fixture type:</strong> ${fixtureType}
            </div>
            <div><strong>Plant:</strong> ${fixturePlant}</div>
            <div style="margin-top: 0.5rem;">
              <strong>Previous owner:</strong> ${oldOwnerEmail || "N/A"}
            </div>
          </div>

          <p style="font-size: 0.9rem; margin-top: 1rem;">
            You will receive notifications for this fixture
            from now on.
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

/**
 * Template for the OLD owner ("you are no longer responsible...")
 */
export function ownerRemovedTemplate(params: OwnerRemovedParams): string {
  const {
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    newOwnerEmail,
  } = params;

  const safeName =
    firstName && firstName.trim().length > 0 ? firstName.trim() : "there";

  const appUrl = process.env.APP_BASE_URL || "http://tm-fixture-counter/";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ownership Changed</title>

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
            <p class="header-subtitle">Ownership removed</p>
          </div>

          <h1 style="font-size: 1.1rem; margin: 0 0 0.75rem 0;">
            You are no longer the owner
          </h1>

          <p style="font-size: 0.95rem; margin: 0 0 0.75rem 0;">
            Hi ${safeName}, you are no longer responsible as owner for the
            following project fixture:
          </p>

          <div class="info-box">
            <div><strong>Project:</strong> ${projectName}</div>
            <div>
              <strong>Adapter code:</strong> ${adapterCode}
              &nbsp;|&nbsp;
              <strong>Fixture type:</strong> ${fixtureType}
            </div>
            <div><strong>Plant:</strong> ${fixturePlant}</div>
            <div style="margin-top: 0.5rem;">
              <strong>New owner:</strong> ${newOwnerEmail || "N/A"}
            </div>
          </div>

          <p style="font-size: 0.9rem; margin-top: 1rem;">
            You will no longer receive notifications for this
            fixture.
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
