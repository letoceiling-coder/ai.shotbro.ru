const brand = {
  bg: "#0f1117",
  card: "#171a22",
  accent: "#7c5cff",
  text: "#e8eaef",
  muted: "#9aa3b2",
};

export function wrapEmailHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${title}</title>
</head>
<body style="margin:0;background:${brand.bg};font-family:Segoe UI,system-ui,sans-serif;color:${brand.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:${brand.card};border-radius:12px;border:1px solid #2a3140;padding:32px;">
          <tr><td style="padding-bottom:16px;font-size:18px;font-weight:600;color:${brand.accent};">SHOTBRO AI Studio</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:${brand.text};">${bodyHtml}</td></tr>
          <tr><td style="padding-top:24px;font-size:12px;color:${brand.muted};">Если вы не запрашивали это письмо, проигнорируйте его.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function actionButton(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:${brand.accent};color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">${label}</a></p>`;
}
