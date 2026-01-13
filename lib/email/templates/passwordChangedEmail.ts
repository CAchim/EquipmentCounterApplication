export function passwordChangedTemplate(firstName: string): string {
  const safeName = firstName && firstName.trim().length > 0 ? firstName : "there";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Password Changed</title>

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
        background: linear-gradient(
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

      .section-title {
        font-size: 1rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
        color: #150452;
      }

      .alert-ok {
        margin: 1rem 0 0.75rem 0;
        padding: 0.8rem 1rem;
        border-radius: 10px;
        background: #ecfdf5;
        border: 1px solid #6ee7b7;
        color: #065f46;
        font-size: 0.9rem;
      }

      .alert-warning {
        margin-top: 0.75rem;
        font-size: 0.9rem;
        color: #b91c1c;
      }

      .footer {
        margin: 1rem -1.5rem -1.5rem -1.5rem;
        padding: 0.4rem 1.5rem;
        font-size: 0.75rem;
        background: linear-gradient(
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
            <p class="header-subtitle">Password change confirmation</p>
          </div>

          <h1 style="font-size: 1.1rem; margin: 0 0 0.75rem 0;">
            Hello ${safeName},
          </h1>

          <p style="font-size: 0.95rem; margin: 0 0 0.75rem 0;">
            This is a confirmation that your password for the Counter Application
            has been changed successfully.
          </p>

          <div class="alert-ok">
            If you made this change, no further action is required.
          </div>

          <p class="alert-warning">
            If you did <strong>not</strong> change your password, please contact
            your local admin or Counter Application administrator.
          </p>

          <p style="font-size: 0.9rem; margin-top: 1rem;">
            Thank you for keeping your account secure.
          </p>

          <div class="footer">
            &copy;&nbsp;Aumovio Romania&nbsp;- Counter Application
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
