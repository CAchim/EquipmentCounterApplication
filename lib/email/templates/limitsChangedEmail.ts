import {
  safeName,
  getAppUrl,
  renderCtaButton,
  buildEmailShell,
} from "./_sharedEmail";

export interface LimitsChangedTemplateParams {
  firstName: string;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  oldWarningAt: number | null;
  newWarningAt: number | null;
  oldLimit: number | null;
  newLimit: number | null;
}

/**
 * Template for "limits changed" notification (warning_at / contacts_limit).
 */
export function limitsChangedTemplate(
  params: LimitsChangedTemplateParams
): string {
  const {
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    oldWarningAt,
    newWarningAt,
    oldLimit,
    newLimit,
  } = params;

  const name = safeName(firstName);
  const appUrl = getAppUrl();

  const formatVal = (v: number | null) =>
    v === null || v === undefined ? "—" : v.toString();

  const warningChanged =
    oldWarningAt !== newWarningAt &&
    (oldWarningAt != null || newWarningAt != null);
  const limitChanged =
    oldLimit !== newLimit && (oldLimit != null || newLimit != null);

  const changeSummaryParts: string[] = [];
  if (warningChanged) {
    changeSummaryParts.push(
      `warning threshold from <strong>${formatVal(
        oldWarningAt
      )}</strong> to <strong>${formatVal(newWarningAt)}</strong>`
    );
  }
  if (limitChanged) {
    changeSummaryParts.push(
      `limit from <strong>${formatVal(oldLimit)}</strong> to <strong>${formatVal(
        newLimit
      )}</strong>`
    );
  }

  const changeSummaryText = changeSummaryParts.length
    ? changeSummaryParts.join(" and ")
    : "thresholds for this fixture";

  const bodyHtml = `
    <h1
      style="
        font-size:18px;
        margin:0 0 12px 0;
        line-height:1.25;
        color:#150452;
      "
    >
      Limits updated for your fixture
    </h1>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Hi ${name}, the <strong>warning / limit settings</strong> for the following
      project fixture in the <strong>Equipment Counter Application</strong> have been updated.
    </p>

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

      <table
        role="presentation"
        width="100%"
        style="
          border-collapse:collapse;
          border-spacing:0;
          margin-top:10px;
          font-size:14px;
          line-height:1.45;
          color:#150452;
        "
      >
        <tr
        style="
          border-top:1px solid #e0e0e0
        "
        >
          <th
            align="left"
            style="
              padding:4px 8px 0 0;
              white-space:nowrap;
              font-weight:600;
              font-size:14px;
            "
          >
            Warning limits
          </th>
          <td style="padding:4px 0;">
            <span style="font-weight:600;">Old:</span>
            &nbsp;${formatVal(oldWarningAt)}
            &nbsp;&nbsp;
            <span style="font-weight:600;">New:</span>
            &nbsp;${formatVal(newWarningAt)}
          </td>
        </tr>

        <tr>
          <th
            align="left"
            style="
              padding:0 8px 4px 0;
              white-space:nowrap;
              font-weight:600;
              font-size:14px;
            "
          >
            Counter Limits
          </th>
          <td style="padding:4px 0;">
            <span style="font-weight:600;">Old:</span>
            &nbsp;${formatVal(oldLimit)}
            &nbsp;&nbsp;
            <span style="font-weight:600;">New:</span>
            &nbsp;${formatVal(newLimit)}
          </td>
        </tr>
      </table>
    </div>

    <p
      style="
        font-size:14px;
        margin:14px 0 0 0;
        line-height:1.45;
        color:#150452;
      "
    >
      In summary, the system has updated ${changeSummaryText}.
      These new values will be used for future warning and limit notifications.
    </p>

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
        margin:10px 0 0 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      If you believe these changes are incorrect, please contact your local admin or Counter Application administrator.
    </p>
  `;

  return buildEmailShell({
    title: "Limits updated for your fixture",
    preheader: `Limits updated for ${projectName} (${adapterCode} / ${fixtureType})`,
    headerSubtitle: "Warning / limit thresholds changed",
    bodyHtml,
  });
}
