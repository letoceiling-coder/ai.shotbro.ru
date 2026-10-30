import { ApiError } from "./api-client";

/** Server error codes of voice/avatar operations → short Russian reasons for the user. */
const MESSAGES: Record<string, string> = {
  consent_required: "Нужно согласие человека, чей голос или лицо используется. Загрузите файл согласия и отметьте галочку.",
  samples_required: "Добавьте хотя бы одну запись голоса.",
  run_cap_exceeded: "Операция дороже лимита на один запуск ($1). Обратитесь к администратору, чтобы поднять лимит.",
  daily_cap_exceeded: "Превышен дневной лимит расходов ($3). Попробуйте завтра или поднимите лимит.",
  talent_busy: "Это задание уже выполняется — дождитесь результата.",
  talent_not_restartable: "В этом статусе запустить нельзя: дождитесь окончания текущей операции.",
  approval_required: "Нужно подтверждение стоимости.",
  approval_mismatch: "Параметры изменились после расчёта цены. Запросите цену заново.",
  quote_expired: "Цена устарела (прошло больше 30 минут). Запросите её заново.",
  quote_missing: "Расчёт цены не найден. Запросите цену заново.",
  live_blocked: "Реальные генерации сейчас выключены администратором. В тестовом режиме результат будет условным.",
  asset_not_ready: "Файл ещё обрабатывается. Подождите несколько секунд и повторите.",
  asset_wrong_type: "Неверный тип файла: для голоса нужны аудиозаписи, для аватара — фото.",
  asset_not_accessible: "Файл недоступен в этом рабочем пространстве.",
  voice_not_accessible: "Голос недоступен или в архиве.",
  avatar_not_accessible: "Аватар недоступен или в архиве.",
  look_not_in_avatar: "Этот образ принадлежит другому аватару.",
  preview_not_found: "Вариант голоса не найден — создайте варианты заново.",
  wrong_voice_kind: "Для этого голоса такая операция недоступна.",
  conversation_required: "В проекте нет чата для карточки подтверждения — откройте раздел «Чат» один раз.",
  invalid_input: "Проверьте заполнение полей.",
};

export function talentErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && MESSAGES[err.code]) return MESSAGES[err.code];
    if (err.status === 429) return "Слишком много запросов — повторите через несколько секунд.";
    if (err.status >= 500) return "Сервер временно недоступен. Повторите позже.";
    const msg = (err.body as { message?: unknown } | undefined)?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
    return `Ошибка ${err.status}${err.code ? ` (${err.code})` : ""}`;
  }
  return err instanceof Error ? err.message : "Неизвестная ошибка";
}
