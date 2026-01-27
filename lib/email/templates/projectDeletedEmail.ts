import {
  buildEmailShell,
  safeName,
  getAppUrl,
  renderCtaButton,
} from "./_sharedEmail";

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

  const name = safeName(firstName);
  const appUrl = getAppUrl();

  const warningText =
    warningAt && warningAt > 0
      ? `${warningAt.toLocaleString("en-US")} contacts`
      : "not defined";

  const limitText =
    limit && limit > 0
      ? `${limit.toLocaleString("en-US")} contacts`
      : "not defined";

  const bodyHtml = `
    <h1
      style="
        font-size:18px;
        margin:0 0 12px 0;
        line-height:1.25;
        color:#150452;
      "
    >
      Fixture entry deleted
    </h1>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Hi ${name}, the following fixture entry has been
      <strong>deleted</strong> from the Counter Application:
    </p>

    <!-- Fixture identity & previous limits -->
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
          <strong>Previous warning limit:</strong> ${warningText}
        </div>
        <div style="margin-bottom:4px;">
          <strong>Previous counter limit:</strong> ${limitText}
        </div>
        <div style="margin-top:4px;">
          <strong>Deleted by:</strong> ${deletedBy}
        </div>
      </div>
    </div>

    <p
      style="
        font-size:13px;
        margin:16px 0 8px 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      This means the counter and its configuration (including limits and owners)
      are no longer active in the Counter Application for this fixture.
    </p>

    <p
      style="
        font-size:13px;
        margin:0 0 16px 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      If this deletion was not expected or was done by mistake,
      please contact the Counter Application administrator.
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
  `;

  return buildEmailShell({
    title: "Fixture entry deleted",
    preheader: `Fixture deleted: ${projectName} (${adapterCode} / ${fixtureType})`,
    headerSubtitle: "A fixture entry was deleted from the Counter Application",
    bodyHtml,
  });
}
