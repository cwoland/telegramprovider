import type { Credentials } from '../types';
import type {
  DeleteNotificationResponse,
  ReceiveNotificationResponse,
  SendMessageResponse,
  StateInstanceResponse,
  GetAvatarResponse,
  InstanceSettings,
  SettingsPatch,
} from './types';

export const DEFAULT_API_URL = 'https://api.green-api.com';

export const MAX_MESSAGE_LENGTH = 4000;

export const DEFAULT_RECEIVE_TIMEOUT_SECONDS = 10;

const DEFAULT_TIMEOUT_MS = 20_000;

const RECEIVE_TIMEOUT_SLACK_MS = 10_000;

export class GreenApiError extends Error {
  readonly status?: number;
  readonly url: string;

  constructor(message: string, params: { url: string; status?: number; cause?: unknown }) {
    super(message, { cause: params.cause });
    this.name = 'GreenApiError';
    this.status = params.status;
    this.url = params.url;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function redactUrl(url: string): string {
  return url.replace(/(\/waInstance\d+\/[^/]+\/)[^/?]+/, '$1***');
}

function buildUrl(
  { apiUrl, idInstance, apiTokenInstance }: Credentials,
  method: string,
  ...segments: (string | number)[]
): string {
  const base = apiUrl.trim().replace(/\/+$/, '');
  const tail = segments.map((segment) => `/${encodeURIComponent(String(segment))}`).join('');
  return `${base}/waInstance${encodeURIComponent(idInstance)}/${method}/${encodeURIComponent(
    apiTokenInstance,
  )}${tail}`;
}

function describeHttpError(status: number, raw: string): string {
  switch (status) {
    case 400:
      return `Некорректный запрос к GREEN-API${raw ? `: ${raw}` : ''}`;
    case 401:
    case 403:
      return 'Неверные idInstance или apiTokenInstance';
    case 429:
      return 'Превышен лимит запросов к GREEN-API, повторите позже';
    case 466:
      return 'Исчерпана квота инстанса или инстанс не оплачен';
    default:
      return `GREEN-API вернул ошибку ${status}${raw ? `: ${raw}` : ''}`;
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(
  url: string,
  init: RequestInit,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {},
): Promise<T | null> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: combinedSignal });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeoutSignal.aborted) {
      throw new GreenApiError(`GREEN-API не ответил за ${timeoutMs} мс`, {
        url: redactUrl(url),
        cause: error,
      });
    }
    throw new GreenApiError('Не удалось связаться с GREEN-API: проверьте сеть и apiUrl', {
      url: redactUrl(url),
      cause: error,
    });
  }

  const raw = (await response.text()).trim();

  if (!response.ok) {
    throw new GreenApiError(describeHttpError(response.status, raw), {
      url: redactUrl(url),
      status: response.status,
    });
  }

  if (raw === '' || raw === 'null') return null;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new GreenApiError('GREEN-API вернул неразбираемый ответ', {
      url: redactUrl(url),
      status: response.status,
      cause: error,
    });
  }
}

function requireBody<T>(value: T | null, url: string): T {
  if (value === null) {
    throw new GreenApiError('GREEN-API вернул пустой ответ', { url: redactUrl(url) });
  }
  return value;
}

export interface GreenApiClient {
  getStateInstance(options?: RequestOptions): Promise<StateInstanceResponse>;
  sendMessage(
    params: { chatId: string; message: string },
    options?: RequestOptions,
  ): Promise<SendMessageResponse>;
  receiveNotification(
    options?: RequestOptions & { receiveTimeout?: number },
  ): Promise<ReceiveNotificationResponse | null>;
  deleteNotification(receiptId: number, options?: RequestOptions): Promise<boolean>;
  getSettings(options?: RequestOptions): Promise<InstanceSettings>;
  setSettings(patch: SettingsPatch, options?: RequestOptions): Promise<void>;
  getAvatar(chatId: string, options?: RequestOptions): Promise<string | null>;
}

export function createGreenApiClient(credentials: Credentials): GreenApiClient {
  return {
    async getStateInstance(options) {
      const url = buildUrl(credentials, 'getStateInstance');
      const data = await request<StateInstanceResponse>(url, { method: 'GET' }, options);
      return requireBody(data, url);
    },

    async sendMessage({ chatId, message }, options) {
      const text = message.trim();
      if (text.length === 0) {
        throw new GreenApiError('Нельзя отправить пустое сообщение', { url: '' });
      }
      if (text.length > MAX_MESSAGE_LENGTH) {
        throw new GreenApiError(`Сообщение длиннее ${MAX_MESSAGE_LENGTH} символов`, { url: '' });
      }

      const url = buildUrl(credentials, 'sendMessage');
      const data = await request<SendMessageResponse>(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: text }),
        },
        options,
      );
      return requireBody(data, url);
    },

    async receiveNotification({
      receiveTimeout = DEFAULT_RECEIVE_TIMEOUT_SECONDS,
      signal,
      timeoutMs,
    } = {}) {
      const url = `${buildUrl(credentials, 'receiveNotification')}?receiveTimeout=${receiveTimeout}`;
      return request<ReceiveNotificationResponse>(
        url,
        { method: 'GET' },
        { signal, timeoutMs: timeoutMs ?? receiveTimeout * 1000 + RECEIVE_TIMEOUT_SLACK_MS },
      );
    },

    async deleteNotification(receiptId, options) {
      const url = buildUrl(credentials, 'deleteNotification', receiptId);
      const data = await request<DeleteNotificationResponse>(url, { method: 'DELETE' }, options);
      return data?.result ?? false;
    },

    async getSettings(options) {
      const url = buildUrl(credentials, 'getSettings');
      const data = await request<InstanceSettings>(url, { method: 'GET' }, options);
      return requireBody(data, url);
    },

    async setSettings(patch, options) {
      const url = buildUrl(credentials, 'setSettings');
      await request<unknown>(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
        options,
      );
    },

    async getAvatar(chatId, options) {
      const url = buildUrl(credentials, 'getAvatar');
      const data = await request<GetAvatarResponse>(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId }),
        },
        options,
      );
      const avatar = data?.urlAvatar ?? '';
      return avatar === '' ? null : avatar;
    },
  };
}