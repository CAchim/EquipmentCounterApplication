// lib/email/templates/_sharedEmail.ts

export interface BuildShellParams {
  title: string;
  preheader: string;
  headerSubtitle: string;
  bodyHtml: string;
  /**
   * Big title in the header bar (top-left). Default: "Counter Application"
   */
  primaryTitle?: string;
}

/**
 * Normalize first name: fall back to "there" if missing.
 */
export function safeName(firstName?: string | null): string {
  if (!firstName) return "there";
  const trimmed = firstName.trim();
  return trimmed.length > 0 ? trimmed : "there";
}

/**
 * Base URL for the app, with a sensible default for dev.
 */
export function getAppUrl(): string {
  return process.env.APP_BASE_URL || "https://tm00094vmx.tm.ro.int.automotive-wan.com";
}

/**
 * CTA button renderer with Outlook VML + HTML fallback.
 * We try very hard to force the label text to stay white.
 */
export function renderCtaButton(
  label: string = "Open Counter Application",
  href?: string
): string {
  const url = href || getAppUrl();

  return `
    <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
        href="${url}"
        style="height:40px;v-text-anchor:middle;width:260px;"
        arcsize="20%"
        stroke="f"
        fillcolor="#ff4000">
        <w:anchorlock/>
        <center style="
          color:#ffffff;
          font-family:Segoe UI, Arial, sans-serif;
          font-size:14px;
          font-weight:600;
        ">
          ${label}
        </center>
      </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
      <a
        href="${url}"
        target="_blank"
        rel="noopener noreferrer"
        style="
          display:inline-block;
          padding:12px 22px;
          border-radius:10px;
          background-color:#ff4000;
          text-decoration:none;
          font-weight:600;
          font-size:14px;
          line-height:1.2;
          mso-line-height-rule:exactly;
          color:#ffffff !important;
        "
      >
        <span
          style="
            color:#ffffff !important;
            text-decoration:none !important;
            display:inline-block;
          "
        >
          ${label}
        </span>
      </a>
    <!--<![endif]-->
  `;
}

/**
 * Shared HTML shell:
 * - gradient header + footer
 * - white rounded card
 * - grey page background
 */
export function buildEmailShell(params: BuildShellParams): string {
  const {
    title,
    preheader,
    headerSubtitle,
    bodyHtml,
    primaryTitle = "Counter Application",
  } = params;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>

    <style>
      /* --- Email resets --- */
      html, body {
        margin:0 !important;
        padding:0 !important;
        width:100% !important;
        height:100% !important;
      }
      * {
        -ms-text-size-adjust:100%;
        -webkit-text-size-adjust:100%;
      }
      table, td {
        border-collapse:collapse !important;
        mso-table-lspace:0pt;
        mso-table-rspace:0pt;
      }
      a {
        text-decoration:none;
      }
      img {
        border:0;
        outline:none;
        text-decoration:none;
        -ms-interpolation-mode:bicubic;
      }

      /* --- Base --- */
      body {
        font-family:"Quicksand", system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        background-color:#f3f4f6;
        color:#150452;
      }

      .wrapper {
        width:100%;
        background-color:#f3f4f6;
        padding:24px 0;
      }

      .container {
        width:100%;
        max-width:860px;
        margin:0 auto;
      }

      .card {
        width:100%;
        background-color:#ffffff;
        border-radius:12px;
        overflow:hidden; /* keeps all four corners clean in every client */
        box-shadow:0 8px 24px rgba(0,0,0,0.06);
      }

      .header-bar,
      .footer {
        /* Fallback solid color */
        background-color:#3e239b;
        /* Gradient for clients that support it */
        background-image:linear-gradient(
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
        color:#ffffff;
      }
    </style>
  </head>

  <body>
    <!-- Preheader (hidden) -->
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" class="wrapper">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" class="container">
            <tr>
              <td style="padding:0 12px;">
                <table role="presentation" width="100%" class="card">
                  <!-- Header -->
                  <tr>
                    <td
                      class="header-bar"
                      style="
                        padding:16px 20px;
                        color:#ffffff;
                        mso-line-height-rule:exactly;
                      "
                    >
                      <p style="margin:0;font-size:18px;font-weight:600;line-height:1.2;color:#ffffff;">
                        ${primaryTitle}
                      </p>
                      <p style="margin:4px 0 0 0;font-size:13px;opacity:0.92;line-height:1.2;color:#ffffff;">
                        ${headerSubtitle}
                      </p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding:22px 20px 12px 20px;">
                      ${bodyHtml}
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td
                      class="footer"
                      style="
                        padding:8px 20px;
                        font-size:12px;
                        text-align:center;
                        color:#ffffff;
                        mso-line-height-rule:exactly;
                      "
                    >
                      &copy;&nbsp;Aumovio Romania&nbsp;- Counter Application
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
