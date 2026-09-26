import { describe, expect, it } from 'vitest';
import { extractText, resolveChatTitle, toChatMessage, toStatusUpdate } from './notification';
import type { NotificationBody } from './types';

const CHAT_ID = '1777771364';

function body(overrides: Partial<NotificationBody> = {}): NotificationBody {
    return {
        typeWebhook: 'incomingMessageReceived',
        timestamp: 1_700_000_000,
        idMessage: 'srv-1',
        senderData: { chatId: CHAT_ID },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'привет' } },
        ...overrides,
    };
}

describe('extractText', () => {
    it('читает textMessage', () => {
        expect(
            extractText({ typeMessage: 'textMessage', textMessageData: { textMessage: 'привет' } }),
        ).toBe('привет');
    });

    it('читает extendedTextMessage: сообщения со ссылкой приходят именно так', () => {
        expect(
            extractText({
                typeMessage: 'extendedTextMessage',
                extendedTextMessageData: { text: 'смотри https://example.com' },
            }),
        ).toBe('смотри https://example.com');
    });

    it('возвращает null для неподдерживаемого типа и отсутствующих данных', () => {
        expect(extractText({ typeMessage: 'imageMessage' })).toBeNull();
        expect(extractText({ typeMessage: 'textMessage' })).toBeNull();
        expect(extractText(undefined)).toBeNull();
    });
});

describe('toChatMessage', () => {
    it('переводит timestamp из секунд в миллисекунды', () => {
        expect(toChatMessage(body())?.timestamp).toBe(1_700_000_000_000);
    });

    it('определяет направление по типу вебхука', () => {
        expect(toChatMessage(body())?.direction).toBe('incoming');
        expect(toChatMessage(body({ typeWebhook: 'outgoingMessageReceived' }))?.direction).toBe(
            'outgoing',
        );
        expect(toChatMessage(body({ typeWebhook: 'outgoingAPIMessageReceived' }))?.direction).toBe(
            'outgoing',
        );
    });

    it.each([
        ['статус доставки', { typeWebhook: 'outgoingMessageStatus' }],
        ['смену состояния инстанса', { typeWebhook: 'stateInstanceChanged' }],
        ['медиасообщение', { messageData: { typeMessage: 'imageMessage' } }],
        ['уведомление без idMessage', { idMessage: undefined }],
        ['уведомление без chatId', { senderData: undefined }],
    ])('игнорирует %s', (_label, overrides) => {
        expect(toChatMessage(body(overrides as Partial<NotificationBody>))).toBeNull();
    });
});

describe('toStatusUpdate', () => {
    it.each([
        ['sent', 'sent'],
        ['delivered', 'delivered'],
        ['read', 'read'],
        ['failed', 'failed'],
        ['noAccount', 'failed'],
        ['notInGroup', 'failed'],
    ])('переводит «%s» в «%s»', (apiStatus, expected) => {
        const update = toStatusUpdate({
            typeWebhook: 'outgoingMessageStatus',
            idMessage: 'srv-1',
            status: apiStatus,
            chatId: CHAT_ID,
        });

        expect(update).toEqual({ idMessage: 'srv-1', status: expected, chatId: CHAT_ID });
    });

    it('игнорирует чужие вебхуки и неизвестные статусы', () => {
        expect(toStatusUpdate(body())).toBeNull();
        expect(
            toStatusUpdate({
                typeWebhook: 'outgoingMessageStatus',
                idMessage: 'srv-1',
                status: 'somethingNew',
            }),
        ).toBeNull();
        expect(toStatusUpdate({ typeWebhook: 'outgoingMessageStatus', status: 'read' })).toBeNull();
    });
});

describe('resolveChatTitle', () => {
    it('предпочитает имя контакта, затем senderName, затем chatName', () => {
        expect(
            resolveChatTitle(
                body({
                    senderData: {
                        chatId: CHAT_ID,
                        senderContactName: 'Иван из адресной книги',
                        senderName: 'Иван',
                        chatName: 'чат',
                    },
                }),
            ),
        ).toBe('Иван из адресной книги');

        expect(resolveChatTitle(body({ senderData: { chatId: CHAT_ID, senderName: 'Иван' } }))).toBe(
            'Иван',
        );
    });

    it('откатывается на chatId, когда имён нет', () => {
        expect(resolveChatTitle(body())).toBe(CHAT_ID);
    });
});
