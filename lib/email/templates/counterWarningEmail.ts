interface CounterWarningTemplateParams {
  firstName: string;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  currentContacts: number;
  warningAt: number;
  limit: number;
  testProbes?: { partNumber: string; qty: number; type?: string }[]; // type is ignored for UI consistency
}

export function counterWarningTemplate(
  params: CounterWarningTemplateParams
): string {
  const {
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    currentContacts,
    warningAt,
    limit,
    testProbes = [],
  } = params;

  const safeName = firstName && firstName.trim() ? firstName.trim() : "there";
  const appUrl = process.env.APP_BASE_URL || "http://tm-fixture-counter/";

  const usagePercent = limit > 0 ? Math.round((currentContacts / limit) * 100) : 0;
  const remainingToLimit = limit > currentContacts ? limit - currentContacts : 0;

  /** sort probes by quantity DESC (same as limit) */
  const sortedProbes = [...testProbes].sort((a, b) => b.qty - a.qty);

  const probesSection =
    sortedProbes.length > 0
      ? `
        <h2 class="section-title">Test probes for this fixture</h2>
        <table class="tp-table">
          <colgroup>
            <col style="width: 65%;" />
            <col style="width: 35%;" />
          </colgroup>
          <thead>
            <tr>
              <th>Part number</th>
              <th class="num">Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${sortedProbes
              .map(
                (tp) => `
              <tr>
                <td>${tp.partNumber}</td>
                <td class="num">${tp.qty}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      `
      : `
        <p style="font-size: 0.9rem; margin-top: 1rem;">
          <strong>Note:</strong> No test probes are registered yet for this fixture in Counter Application.
        </p>
      `;

  /** (optional) small usage bar, styled to match the limit look */
  const usageBar = `
    <div style="width: 100%; background-color: #3a3a3a; border-radius: 10px; height: 6px; margin-top: 10px;">
      <div style="width: ${Math.min(usagePercent, 100)}%; background-color: #ff4000; border-radius: 10px; height: 100%"></div>
    </div>
  `;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Counter Warning</title>

    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Quicksand", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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

      .section-title {
        font-size: 1rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
        color: #150452;
      }

      .metrics-table,
      .tp-table {
        border-collapse: separate;
        border-spacing: 0;
        font-size: 0.9rem;
        margin-top: 0.75rem;
        width: 100%;
      }

      .metrics-table td,
      .tp-table th,
      .tp-table td {
        border: 1px solid #ddd;
        padding: 6px 10px;
        text-align: left;
      }

      .tp-table th {
        background: #f0f0f5;
        font-weight: 600;
      }

      .num {
        text-align: right !important;
        white-space: nowrap;
      }

      /* Rounded corners for tp table */
      .tp-table thead tr th:first-child {
        border-top-left-radius: 8px;
      }
      .tp-table thead tr th:last-child {
        border-top-right-radius: 8px;
      }
      .tp-table tbody tr:last-child td:first-child {
        border-bottom-left-radius: 8px;
      }
      .tp-table tbody tr:last-child td:last-child {
        border-bottom-right-radius: 8px;
      }

      /* Rounded corners for metrics table (no thead) */
      .metrics-table tbody tr:first-child td:first-child {
        border-top-left-radius: 8px;
      }
      .metrics-table tbody tr:first-child td:last-child {
        border-top-right-radius: 8px;
      }
      .metrics-table tbody tr:last-child td:first-child {
        border-bottom-left-radius: 8px;
      }
      .metrics-table tbody tr:last-child td:last-child {
        border-bottom-right-radius: 8px;
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
            <p class="header-subtitle">Warning threshold reached</p>
          </div>

          <h1 style="font-size: 1.1rem; margin: 0 0 0.75rem 0;">
            Hello ${safeName},
          </h1>

          <p style="font-size: 0.95rem; margin: 0 0 0.75rem 0;">
            The <strong>warning threshold</strong> has been reached for the following project:
          </p>

          <div class="info-box">
            <div><strong>Project:</strong> ${projectName}</div>
            <div>
              <strong>Adapter:</strong> ${adapterCode}
              &nbsp;|&nbsp;
              <strong>Fixture:</strong> ${fixtureType}
            </div>
            <div><strong>Plant:</strong> ${fixturePlant}</div>
          </div>

          <h2 class="section-title">Contacts overview</h2>

          <table class="metrics-table">
            <colgroup>
              <col style="width: 65%;" />
              <col style="width: 35%;" />
            </colgroup>
            <tbody>
              <tr><td>Current number of contacts</td><td class="num">${currentContacts}</td></tr>
              <tr><td>Warning limit</td><td class="num">${warningAt}</td></tr>
              <tr><td>Limit</td><td class="num">${limit}</td></tr>
              <tr><td>Usage</td><td class="num">${usagePercent}%</td></tr>
              <tr><td>Remaining contacts</td><td class="num">${remainingToLimit}</td></tr>
            </tbody>
          </table>

          ${usageBar}

          <p style="font-size: 0.9rem; margin-top: 1rem;">
            Please review the fixture usage, check the test probes avalabilitty and plan the fixture maintenance.
          </p>

          ${probesSection}

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
