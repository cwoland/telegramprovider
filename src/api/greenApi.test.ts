import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { TEST_CREDENTIALS, endpoint } from '../test/greenApi';
import { server } from '../test/server';
import { GreenApiError, createGreenApiClient, isAbortError } from './greenApi';

const client = createGreenApiClient(TEST_CREDENTIALS);

describe('sendMessage', () => {
    it('отправляет POST с chatId и message и возвращает idMessage', async () => {
        const received: unknown[] = [];
        server.use(
            http.post(endpoint('sendMessage'), async ({ request }) => {
                received.push(await request.json());
                return HttpResponse.json({ idMessage: 'srv-1' });
            }),
        );

        const response = await client.sendMessage({ chatId: '1777771364', message: '  привет  ' });

        expect(response).toEqual({ idMessage: 'srv-1' });
        expect(received).toEqual([{ chatId: '1777771364', message: 'привет' }]);
    });

    it('не делает запрос при пустом тексте', async () => {
        const handler = vi.fn(() => HttpResponse.json({ idMessage: 'не должно случиться' }));
        server.use(http.post(endpoint('sendMessage'), handler));

        await expect(client.sendMessage({ chatId: '1', message: '   ' })).rejects.toThrow(
            'Нельзя отправить пустое сообщение',
        );
        expect(handler).not.toHaveBeenCalled();
    });

    it('не делает запрос при превышении лимита длины', async () => {
        const handler = vi.fn(() => HttpResponse.json({ idMessage: 'не должно случиться' }));
        server.use(http.post(endpoint('sendMessage'), handler));

        await expect(client.sendMessage({ chatId: '1', message: 'я'.repeat(4001) })).rejects.toThrow(
            /длиннее 4000/,
        );
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('receiveNotification', () => {
    it('возвращает null, когда очередь пуста (тело `null`)', async () => {
        await expect(client.receiveNotification()).resolves.toBeNull();
    });

    it('возвращает null и на полностью пустое тело', async () => {
        server.use(http.get(endpoint('receiveNotification'), () => new HttpResponse('')));
        await expect(client.receiveNotification()).resolves.toBeNull();
    });

    it('передаёт receiveTimeout в query', async () => {
        const seen: string[] = [];
        server.use(
            http.get(endpoint('receiveNotification'), ({ request }) => {
                seen.push(new URL(request.url).searchParams.get('receiveTimeout') ?? '');
                return HttpResponse.json(null);
            }),
        );

        await client.receiveNotification({ receiveTimeout: 25 });
        expect(seen).toEqual(['25']);
    });
});

describe('deleteNotification', () => {
    it('отправляет DELETE с receiptId в пути', async () => {
        const seen: string[] = [];
        server.use(
            http.delete(`${endpoint('deleteNotification')}/:receiptId`, ({ params }) => {
                seen.push(String(params.receiptId));
                return HttpResponse.json({ result: true });
            }),
        );

        await expect(client.deleteNotification(1001)).resolves.toBe(true);
        expect(seen).toEqual(['1001']);
    });
});

describe('checkAccount', () => {
    it('шлёт номер числом, а не строкой', async () => {
        const received: unknown[] = [];
        server.use(
            http.post(endpoint('checkAccount'), async ({ request }) => {
                received.push(await request.json());
                return HttpResponse.json({ exist: true, chatId: '1777771364' });
            }),
        );

        await client.checkAccount('79991234567');
        expect(received).toEqual([{ phoneNumber: 79991234567 }]);
    });
});

describe('getAvatar', () => {
    it('превращает пустой urlAvatar в null', async () => {
        await expect(client.getAvatar('1777771364')).resolves.toBeNull();
    });

    it('возвращает ссылку, когда аватар есть', async () => {
        server.use(
            http.post(endpoint('getAvatar'), () => HttpResponse.json({ urlAvatar: 'https://cdn/a.jpg' })),
        );
        await expect(client.getAvatar('1777771364')).resolves.toBe('https://cdn/a.jpg');
    });
});

describe('обработка ошибок', () => {
    it.each([
        [401, 'Неверные idInstance или apiTokenInstance'],
        [403, 'Неверные idInstance или apiTokenInstance'],
        [429, 'Превышен лимит запросов к GREEN-API, повторите позже'],
        [466, 'Исчерпана квота инстанса или инстанс не оплачен'],
    ])('%i превращается в понятное сообщение', async (status, message) => {
        server.use(http.get(endpoint('getStateInstance'), () => new HttpResponse('', { status })));

        const error = await client.getStateInstance().catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(GreenApiError);
        expect(error).toMatchObject({ status, message });
    });

    it('не раскрывает apiTokenInstance в данных ошибки', async () => {
        server.use(http.get(endpoint('getStateInstance'), () => new HttpResponse('', { status: 500 })));

        const error = (await client
            .getStateInstance()
            .catch((reason: unknown) => reason)) as GreenApiError;

        expect(error.url).not.toContain(TEST_CREDENTIALS.apiTokenInstance);
        expect(error.url).toContain('***');
        expect(error.message).not.toContain(TEST_CREDENTIALS.apiTokenInstance);
    });

    it('сообщает о неразбираемом ответе', async () => {
        server.use(http.get(endpoint('getStateInstance'), () => new HttpResponse('<html>502</html>')));

        await expect(client.getStateInstance()).rejects.toThrow(
            'GREEN-API вернул неразбираемый ответ',
        );
    });

    it('пробрасывает отмену как AbortError, не заворачивая в GreenApiError', async () => {
        const controller = new AbortController();
        server.use(
            http.get(endpoint('getStateInstance'), async () => {
                await new Promise((resolve) => setTimeout(resolve, 200));
                return HttpResponse.json({ stateInstance: 'authorized' });
            }),
        );

        const promise = client.getStateInstance({ signal: controller.signal });
        controller.abort();
        const error = await promise.catch((reason: unknown) => reason);

        expect(isAbortError(error)).toBe(true);
        expect(error).not.toBeInstanceOf(GreenApiError);
    });
});
