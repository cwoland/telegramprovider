const CHAT_ID_SUFFIX = '@c.us';

const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

export type RecipientParseResult = 
    | { ok: true; chatId: string; display: string }
    | { ok: false; error: string };

function normalizeRussianDigits(digits: string, hadPlusPrefix: boolean): string {
    if (hadPlusPrefix) return digits;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('9')) return `7${digits}`;
    return digits;
}

export function formatPhone(digits: string): string {
    if (digits.length === 11 && digits.startsWith('7')) {
        const [, a, b, c, d] = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits) ?? [];
        if (a) return `+7 (${a}) ${b}-${c}-${d}`;
    }
    return `+${digits}`;
}

export function chatIdToDigits(chatId: string): string {
    return chatId.endsWith(CHAT_ID_SUFFIX) ? chatId.slice(0, - CHAT_ID_SUFFIX.length) : chatId;
}

export function parseRecipient(input: string): RecipientParseResult {
  const value = input.trim();
  if (value === '') {
    return { ok: false, error: 'Введите номер телефона' };
  }

  if (value.endsWith(CHAT_ID_SUFFIX)) {
    const digits = chatIdToDigits(value);
    if (!/^\d+$/.test(digits) || digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
      return { ok: false, error: 'Некорректный идентификатор чата' };
    }
    return { ok: true, chatId: value, display: formatPhone(digits) };
  }

  const hadPlusPrefix = value.startsWith('+');
  const rawDigits = value.replace(/\D/g, '');

  if (rawDigits === '') {
    return { ok: false, error: 'Номер должен содержать цифры' };
  }

  const digits = normalizeRussianDigits(rawDigits, hadPlusPrefix);

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
    return { ok: false, error: `Номер должен содержать от ${MIN_DIGITS} до ${MAX_DIGITS} цифр` };
  }
  if (digits.startsWith('0')) {
    return { ok: false, error: 'Укажите номер с кодом страны, например +7 999 123-45-67' };
  }

  return { ok: true, chatId: `${digits}${CHAT_ID_SUFFIX}`, display: formatPhone(digits) };
}