import {
  buildEmailShell,
  getAppUrl,
  renderCtaButton,
  safeName,
} from "./_sharedEmail";

interface CounterLimitTemplateParams {
  firstName: string;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  currentContacts: number;
  limit: number;
  testProbes?: { partNumber: string; qty: number; type?: string }[];
}

export function counterLimitTemplate(
  params: CounterLimitTemplateParams
): string {
  const {
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    currentContacts,
    limit,
    testProbes = [],
  } = params;

  const name = safeName(firstName);
  const appUrl = getAppUrl();

  // ----- Usage & progress -----
  const usagePercent =
    limit > 0 ? Math.round((currentContacts / limit) * 100) : 0;

  const visualUsagePercent = Math.min(100, usagePercent);
  const isOverLimit = usagePercent > 100;



  let usageColor = "#22c55e"; // green
  if (usagePercent >= 100) {
    usageColor = "#b91c1c"; // red
  } else if (usagePercent >= 90) {
    usageColor = "#ea580c"; // orange
  } else if (usagePercent >= 70) {
    usageColor = "#eab308"; // yellow
  }

  const remainingToLimit = limit > currentContacts ? limit - currentContacts : 0;
  const exceededContacts = currentContacts > limit ? currentContacts - limit : 0;

  const limitText =
    limit > 0 ? `${limit.toLocaleString("en-US")} contacts` : "not defined";

  // Sort probes by quantity DESC (same as warning template)
  const sortedProbes = [...testProbes].sort((a, b) => b.qty - a.qty);

  const probesSection =
    sortedProbes.length > 0
      ? `
    <h2
      style="
        font-size:16px;
        margin:18px 0 8px 0;
        line-height:1.3;
        color:#150452;
      "
    >
      Required test probes for this fixture
    </h2>

    <p
      style="
        font-size:13px;
        margin:0 0 10px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      The following test probes are currently registered for this fixture.
      Please prepare the necessary probes for maintenance.
    </p>

    <div
      style="
        margin-top:8px;
        border-radius:10px;
        border:1px solid #e0e0e0;
        overflow:hidden;
      "
    >
      <table
        role="presentation"
        width="100%"
        style="
          border-collapse:collapse;
          border-spacing:0;
          font-size:13px;
          line-height:1.45;
          color:#150452;
        "
      >
        <thead>
          <tr
            style="
              background:#f3f4f6;
              border-bottom:1px solid #e0e0e0;
            "
          >
            <th
              align="left"
              style="
                padding:6px 10px;
                font-weight:600;
                font-size:12px;
                text-transform:uppercase;
                letter-spacing:0.03em;
              "
            >
              Part Number
            </th>
            <th
              align="right"
              style="
                padding:6px 10px;
                font-weight:600;
                font-size:12px;
                text-transform:uppercase;
                letter-spacing:0.03em;
                white-space:nowrap;
              "
            >
              Qty
            </th>
          </tr>
        </thead>
        <tbody>
          ${sortedProbes
            .map(
              (probe) => `
            <tr style="border-top:1px solid #e0e0e0;">
              <td
                style="
                  padding:6px 10px;
                  font-family:monospace;
                  font-size:12px;
                  word-break:break-all;
                "
              >
                ${probe.partNumber}
              </td>
              <td
                align="right"
                style="padding:6px 10px;font-size:13px;"
              >
                ${probe.qty}
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `
      : `
    <p
      style="
        font-size:13px;
        margin:16px 0 0 0;
        line-height:1.45;
        color:#150452;
      "
    >
      <strong>Note:</strong>
      No test probes are registered yet for this fixture in the Counter Application.
    </p>
  `;

  const bodyHtml = `
    <h1
      style="
        font-size:18px;
        margin:0 0 12px 0;
        line-height:1.25;
        color:#150452;
      "
    >
      Counter limit reached
    </h1>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Hi ${name}, the contacts counter for the following fixture has
      <strong>reached or exceeded the configured limit</strong> in the Counter Application.
      The fixture should be serviced as soon as possible and the counter reset after maintenance.
    </p>

    <!-- Fixture identity box -->
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
      <div><strong>Project:</strong> ${projectName}</div>
      <div>
        <strong>Adapter code:</strong> ${adapterCode}
        &nbsp;|&nbsp;
        <strong>Fixture type:</strong> ${fixtureType}
      </div>
      <div><strong>Plant:</strong> ${fixturePlant}</div>

      <div
        style="
          margin-top:10px;
          padding-top:10px;
          border-top:1px solid #e0e0e0;
          font-size:13px;
          color:#150452;
        "
      >
        <div style="margin-bottom:4px;">
          <strong>Current contacts:</strong>
          ${currentContacts.toLocaleString("en-US")}
        </div>
        <div>
          <strong>Counter limit:</strong> ${limitText}
        </div>
        <div>
          <strong>No. of remaining contacts:</strong> ${remainingToLimit}
        </div>
        ${
          exceededContacts > 0
            ? `<div>
                 <strong>Contacts above limit:</strong> ${exceededContacts.toLocaleString(
                   "en-US"
                 )}
               </div>`
            : ""
        }

        <!-- Usage badge -->
        <div
          style="
            margin-top:8px;
            display:inline-block;
            padding:2px;
            border-radius:999px;
            background:${isOverLimit ? "#b91c1c1a" : usageColor + "1a"};
            color:${isOverLimit ? "#b91c1c" : usageColor};
            font-size:13px;
            font-weight:600;
            text-transform:uppercase;
            letter-spacing:0.04em;
          "
        >
          Usage: ${usagePercent}%
        </div>

        <!-- Progress bar -->
        <div style="margin-top:1px;">
          <div
            style="
              width:100%;
              height:7px;
              border-radius:999px;
              background:#ffffff;
              overflow:hidden;
            "
          >
            <div
              style="
                width:${visualUsagePercent}%;
                max-width:100%;
                height:100%;
                background:${usageColor};
              "
            ></div>
          </div>
          <div
            style="
              font-size:12px;
              padding:2px;
              margin-bottom:3px;
              color:${usageColor};
            "
          >
            ${currentContacts.toLocaleString("en-US")}
            /
            ${limit > 0 ? limit.toLocaleString("en-US") : "—"}
          </div>
        </div>
      </div>
    </div>

    ${probesSection}

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
        font-size:12px;
        margin:16px 0 0 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      If this fixture is already under maintenance or the limits are no longer valid,
      please update the settings in the Counter Application.
    </p>
  `;

  return buildEmailShell({
    title: "Counter limit reached",
    preheader: `Counter limit reached for ${projectName} (${adapterCode} / ${fixtureType})`,
    headerSubtitle: "Counter limit reached for a fixture",
    bodyHtml,
  });
}
