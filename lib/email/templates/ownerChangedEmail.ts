import {
  buildEmailShell,
  renderCtaButton,
  safeName,
  getAppUrl,
} from "./_sharedEmail";

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

  const name = safeName(firstName);
  const appUrl = getAppUrl();

  const bodyHtml = `
    <h1 style="font-size:18px;margin:0 0 12px 0;line-height:1.25;color:#150452;">
      You are now the owner
    </h1>

    <p style="font-size:14px;margin:0 0 12px 0;line-height:1.45;color:#150452;">
      Hi ${name}, you have been assigned as the <strong>owner</strong> of the following project fixture in the
      <strong>Equipment Counter Application</strong>:
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
      <div style="margin-top:8px;">
        <strong>Previous owner:</strong> ${oldOwnerEmail || "N/A"}
      </div>
    </div>

    <p style="font-size:14px;margin:14px 0 0 0;line-height:1.45;color:#150452;">
      You will receive notifications for this fixture from now on.
    </p>

    <div style="text-align:center;margin-top:18px;margin-bottom:10px;">
      ${renderCtaButton("Open Counter Application", appUrl)}
    </div>
  `;

  return buildEmailShell({
    title: "New Owner Assigned",
    headerSubtitle: "New owner assigned to a fixture",
    preheader: `You are now the owner for ${projectName} (${adapterCode} / ${fixtureType})`,
    bodyHtml,
  });
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

  const name = safeName(firstName);
  const appUrl = getAppUrl();

  const bodyHtml = `
    <h1 style="font-size:18px;margin:0 0 12px 0;line-height:1.25;color:#150452;">
      You are no longer the owner
    </h1>

    <p style="font-size:14px;margin:0 0 12px 0;line-height:1.45;color:#150452;">
      Hi ${name}, you are no longer responsible as owner for the following project fixture:
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
      <div style="margin-top:8px;">
        <strong>New owner:</strong> ${newOwnerEmail || "N/A"}
      </div>
    </div>

    <p style="font-size:14px;margin:14px 0 0 0;line-height:1.45;color:#150452;">
      You will no longer receive notifications for this fixture.
    </p>

    <div style="text-align:center;margin-top:18px;margin-bottom:10px;">
      ${renderCtaButton("Open Counter Application", appUrl)}
    </div>
  `;

  return buildEmailShell({
    title: "Ownership Changed",
    headerSubtitle: "Ownership removed",
    preheader: `Ownership removed for ${projectName} (${adapterCode} / ${fixtureType})`,
    bodyHtml,
  });
}
