import {
  buildEmailShell,
  renderCtaButton,
  safeName,
  getAppUrl,
} from "./_sharedEmail";

export interface EquipmentCreatedTemplateParams {
  firstName: string | null;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  warningAt?: number | null;
  limit?: number | null;
}

/**
 * Template for notifying the owner that a new equipment was created.
 */
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

  const name = safeName(firstName || "");
  const appUrl = getAppUrl();

  const thresholdsHtml =
    warningAt != null || limit != null
      ? `
        <div style="margin-top:8px;">
          <div>
            <strong>Warning at:</strong>
            &nbsp;${warningAt != null ? warningAt.toLocaleString("en-US") : "not set"}
          </div>
          <div>
            <strong>Limit:</strong>
            &nbsp;${limit != null ? limit.toLocaleString("en-US") : "not set"}
          </div>
        </div>
      `
      : "";

  const bodyHtml = `
    <h1 style="font-size:18px;margin:0 0 12px 0;line-height:1.25;color:#150452;">
      New equipment registered
    </h1>

    <p style="font-size:14px;margin:0 0 12px 0;line-height:1.45;color:#150452;">
      Hi ${name}, a new project fixture has been registered in the
      <strong>Equipment Counter Application</strong>, and you are set as the owner.
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
      ${thresholdsHtml}
    </div>

    <p style="font-size:14px;margin:14px 0 0 0;line-height:1.45;color:#150452;">
      You will receive usage and counter notifications for this fixture according to the configured thresholds.
    </p>

    <div style="text-align:center;margin-top:18px;margin-bottom:10px;">
      ${renderCtaButton("Open Counter Application", appUrl)}
    </div>
  `;

  return buildEmailShell({
    title: "New Equipment Created",
    headerSubtitle: "A new fixture was added to your plant",
    preheader: `New fixture: ${projectName} (${adapterCode} / ${fixtureType})`,
    bodyHtml,
  });
}
