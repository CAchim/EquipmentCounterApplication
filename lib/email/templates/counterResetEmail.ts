// lib/email/templates/counterResetEmail.ts

import {
  safeName,
  getAppUrl,
  renderCtaButton,
  buildEmailShell,
} from "./_sharedEmail";

interface CounterResetParams {
  firstName: string;
  projectName: string;
  adapterCode: string;
  fixtureType: string;
  fixturePlant: string;
  performedBy: string;
  oldContacts: number;
}

export function counterResetTemplate(params: CounterResetParams): string {
  const {
    firstName,
    projectName,
    adapterCode,
    fixtureType,
    fixturePlant,
    performedBy,
    oldContacts,
  } = params;

  const name = safeName(firstName);
  const appUrl = getAppUrl();

  const bodyHtml = `
    <h1
      style="
        font-size:18px;
        margin:0 0 12px 0;
        line-height:1.25;
        color:#150452;
      "
    >
      Counter reset performed
    </h1>

    <p
      style="
        font-size:14px;
        margin:0 0 12px 0;
        line-height:1.45;
        color:#150452;
      "
    >
      Hi ${name}, the counter for the following fixture has been
      <strong>reset</strong> in the
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
        <strong>Reset performed by:</strong> ${performedBy}
      </div>
      <div style="margin-top:4px;">
        <strong>Previous contacts:</strong> ${oldContacts}
      </div>
    </div>

    <p
      style="
        font-size:14px;
        margin:14px 0 0 0;
        line-height:1.45;
        color:#150452;
      "
    >
      The fixture is now ready for a new cycle of usage. You will receive
      notifications again as the contacts approach the configured warning and
      limit thresholds based on the updated counter.
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
        margin:18px 0 0 0;
        line-height:1.45;
        color:#4b5563;
      "
    >
      If you did not expect this reset or believe it was performed in error,
      please contact the fixture owner or Counter Application administrator.
    </p>
  `;

  return buildEmailShell({
    title: "Fixture Counter Reset",
    preheader: `Counter for ${projectName} (${adapterCode} / ${fixtureType}) has been reset.`,
    headerSubtitle: "Fixture counter reset notification",
    bodyHtml,
  });
}
