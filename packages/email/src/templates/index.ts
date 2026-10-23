import { actionButton, wrapEmailHtml } from "./layout.js";

export type EmailTemplate = { subject: string; text: string; html: string };

function linkBlock(url: string): string {
  return `<p style="word-break:break-all;font-size:13px;color:#9aa3b2;">${url}</p>`;
}

export function verifyEmailTemplate(params: {
  verifyUrl: string;
  expiresMinutes: number;
}): EmailTemplate {
  const subject = "Подтвердите email — SHOTBRO AI Studio";
  const text = `Подтвердите email в SHOTBRO AI Studio.\n\nСсылка (действует ${params.expiresMinutes} мин.):\n${params.verifyUrl}\n`;
  const html = wrapEmailHtml(
    subject,
    `<p>Подтвердите адрес электронной почты, чтобы продолжить работу в студии.</p>
     ${actionButton(params.verifyUrl, "Подтвердить email")}
     <p style="font-size:13px;color:#9aa3b2;">Ссылка одноразовая и истекает через ${params.expiresMinutes} мин.</p>
     ${linkBlock(params.verifyUrl)}`,
  );
  return { subject, text, html };
}

export function passwordResetTemplate(params: {
  resetUrl: string;
  expiresMinutes: number;
}): EmailTemplate {
  const subject = "Сброс пароля — SHOTBRO AI Studio";
  const text = `Запрос на сброс пароля.\n\nСсылка (${params.expiresMinutes} мин.):\n${params.resetUrl}\n`;
  const html = wrapEmailHtml(
    subject,
    `<p>Мы получили запрос на сброс пароля. Если это были вы, нажмите кнопку ниже.</p>
     ${actionButton(params.resetUrl, "Сбросить пароль")}
     <p style="font-size:13px;color:#9aa3b2;">Ссылка одноразовая. После использования повторный вход по ней будет отклонён.</p>
     ${linkBlock(params.resetUrl)}`,
  );
  return { subject, text, html };
}

export function passwordChangedTemplate(params: { supportUrl?: string }): EmailTemplate {
  const subject = "Пароль изменён — SHOTBRO AI Studio";
  const text = `Пароль вашей учётной записи SHOTBRO AI Studio был изменён.\nЕсли это были не вы, немедленно обратитесь в поддержку.\n`;
  const html = wrapEmailHtml(
    subject,
    `<p>Пароль вашей учётной записи был успешно изменён.</p>
     <p>Если вы не выполняли это действие, срочно свяжитесь с поддержкой${
       params.supportUrl ? ` (<a href="${params.supportUrl}" style="color:#7c5cff;">${params.supportUrl}</a>)` : ""
     }.</p>`,
  );
  return { subject, text, html };
}

export function welcomeTemplate(params: { appUrl: string; name?: string }): EmailTemplate {
  const subject = "Добро пожаловать в SHOTBRO AI Studio";
  const greeting = params.name ? `, ${params.name}` : "";
  const text = `Добро пожаловать${greeting}!\n\nОткройте студию: ${params.appUrl}\n`;
  const html = wrapEmailHtml(
    subject,
    `<p>Добро пожаловать${greeting}!</p>
     <p>Вы можете создавать рекламные ролики, аватары, мультфильмы и фото-проекты в одном чат-интерфейсе.</p>
     ${actionButton(params.appUrl, "Открыть студию")}`,
  );
  return { subject, text, html };
}
