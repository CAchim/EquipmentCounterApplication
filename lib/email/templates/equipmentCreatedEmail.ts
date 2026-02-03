import {
  buildEmailShell,
  getAppUrl,
  renderCtaButton,
  safeName,
} from "./_sharedEmail";

interface EquipmentCreatedTemplateParams {
  firstName: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  warningAt?: number | null;
  limit?: number | null;
}

export function equipmentCreatedTemplate(
  params: EquipmentCreatedTemplateParams
): string {
  const {
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    warningAt,
    limit,
  } = params;

  const name = safeName(firstName);
  const appUrl = getAppUrl();

  // You can tune this deep-link later to match your routing
  const detailUrl = `${appUrl}?adapter_code=${encodeURIComponent(
    adapterCode
  )}&fixture_type=${encodeURIComponent(fixtureType)}`;

  const thresholdsRows =
    warningAt != null || limit != null
      ? `
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #555555;">
            <strong>Warning at:</strong>
          </td>
          <td style="padding: 4px 0; font-size: 14px; color: #555555;">
            ${
              warningAt != null
                ? warningAt.toLocaleString("en-US")
                : "<span style='color:#999999'>not set</span>"
            }
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #555555;">
            <strong>Limit:</strong>
          </td>
          <td style="padding: 4px 0; font-size: 14px; color: #555555;">
            ${
              limit != null
                ? limit.toLocaleString("en-US")
                : "<span style='color:#999999'>not set</span>"
            }
          </td>
        </tr>
      `
      : "";

  const bodyHtml = `
    <p style="margin: 0 0 12px 0; font-size: 15px; color: #333333;">
      Hi ${name},
    </p>

    <p style="margin: 0 0 12px 0; font-size: 15px; color: #333333;">
      A new equipment has been registered in the Counter Application.
    </p>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 14px;
        color: #333333;
      "
    >
      <tr>
        <td style="padding: 4px 0; width: 140px;"><strong>Project name:</strong></td>
        <td style="padding: 4px 0;">${projectName}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0;"><strong>Adapter code:</strong></td>
        <td style="padding: 4px 0;">${adapterCode}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0;"><strong>Fixture type:</strong></td>
        <td style="padding: 4px 0;">${fixtureType}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0;"><strong>Plant:</strong></td>
        <td style="padding: 4px 0;">${fixturePlant}</td>
      </tr>
      ${thresholdsRows}
    </table>

    <p style="margin: 0 0 16px 0; font-size: 14px; color: #555555;">
      You can open the equipment in the Counter Application using the button below.
    </p>

    ${renderCtaButton("Open equipment in Counter Application", detailUrl)}

    <p style="margin: 16px 0 0 0; font-size: 12px; color: #999999;">
      This is an automated notification from the Counter Application.
    </p>
  `;

  return buildEmailShell({
    title: "New equipment registered",
    preheader: `Equipment ${adapterCode} / ${fixtureType} has been added to the Counter Application.`,
    headerSubtitle: fixturePlant ? `Plant: ${fixturePlant}` : "",
    bodyHtml,
    primaryTitle: "Counter Application",
  });
}
