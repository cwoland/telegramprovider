import { HttpResponse, delay, http } from 'msw';
import type { NotificationBody, ReceiveNotificationResponse } from '../api/types';
import type { Credentials } from '../types';

export const TEST_CREDENTIALS: Credentials = {
    apiUrl: 'https://api.green-api.com',
    idInstance: '1101123456',
    apiTokenInstance: 'test-token',
};

export const TEST_PHONE = '79991234567';
export const TEST_PHONE_DISPLAY = '+7 (999) 123-45-67';
export const TEST_CHAT_ID = '1777771364';

export function endpoint(method: string): string {
    const { apiUrl, idInstance, apiTokenInstance } = TEST_CREDENTIALS;
    return `${apiUrl}/waInstance${idInstance}/${method}/${apiTokenInstance}`;
}

export function idleQueueHandler(holdMs = 30) {
    return http.get(endpoint('receiveNotification'), async () => {
        await delay(holdMs);
        return HttpResponse.json(null);
    });
}

export function deleteNotificationHandler() {
    return http.delete(`${endpoint('deleteNotification')}/:receiptId`, () =>
        HttpResponse.json({ result: true }),
    );
}

export function settingsHandler(overrides: Record<string, string> = {}) {
    return http.get(endpoint('getSettings'), () =>
        HttpResponse.json({
            webhookUrl: '',
            incomingWebhook: 'yes',
            outgoingWebhook: 'yes',
            outgoingMessageWebhook: 'yes',
            outgoingAPIMessageWebhook: 'yes',
            stateWebhook: 'yes',
            ...overrides,
        }),
    );
}

export function setSettingsHandler() {
    return http.post(endpoint('setSettings'), () => HttpResponse.json({ saveSettings: true }));
}

export function avatarHandler(urlAvatar = '') {
    return http.post(endpoint('getAvatar'), () => HttpResponse.json({ urlAvatar }));
}

export function checkAccountHandler(chatId: string = TEST_CHAT_ID, exist = true) {
    return http.post(endpoint('checkAccount'), () =>
        HttpResponse.json(exist ? { exist, chatId, fromCache: false } : { exist: false }),
    );
}

export function authorizedHandler(stateInstance = 'authorized') {
    return http.get(endpoint('getStateInstance'), () => HttpResponse.json({ stateInstance }));
}

export function notificationQueue(holdMs = 30) {
    const queue: ReceiveNotificationResponse[] = [];
    const deleted: number[] = [];
    let nextReceiptId = 1001;

    return {
        deleted,
        push(body: NotificationBody): number {
            const receiptId = nextReceiptId;
            nextReceiptId += 1;
            queue.push({ receiptId, body });
            return receiptId;
        },
        handlers: [
            http.get(endpoint('receiveNotification'), async () => {
                const head = queue[0];
                if (head === undefined) {
                    await delay(holdMs);
                    return HttpResponse.json(null);
                }
                return HttpResponse.json(head);
            }),
            http.delete(`${endpoint('deleteNotification')}/:receiptId`, ({ params }) => {
                const receiptId = Number(params.receiptId);
                if (queue[0]?.receiptId === receiptId) queue.shift();
                deleted.push(receiptId);
                return HttpResponse.json({ result: true });
            }),
        ],
    };
}

export function incomingTextNotification(params: {
    chatId?: string;
    text: string;
    idMessage?: string;
    senderName?: string;
    timestamp?: number;
}): NotificationBody {
    return {
        typeWebhook: 'incomingMessageReceived',
        timestamp: params.timestamp ?? Math.floor(Date.now() / 1000),
        idMessage: params.idMessage ?? 'incoming-1',
        senderData: { chatId: params.chatId ?? TEST_CHAT_ID, senderName: params.senderName },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: params.text } },
    };
}

export function outgoingEchoNotification(params: {
    chatId?: string;
    text: string;
    idMessage: string;
    senderName?: string;
}): NotificationBody {
    return {
        typeWebhook: 'outgoingAPIMessageReceived',
        timestamp: Math.floor(Date.now() / 1000),
        idMessage: params.idMessage,
        senderData: { chatId: params.chatId ?? TEST_CHAT_ID, senderName: params.senderName },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: params.text } },
    };
}

export function statusNotification(params: {
    idMessage: string;
    status: string;
    chatId?: string;
}): NotificationBody {
    return {
        typeWebhook: 'outgoingMessageStatus',
        timestamp: Math.floor(Date.now() / 1000),
        idMessage: params.idMessage,
        status: params.status,
        chatId: params.chatId ?? TEST_CHAT_ID,
    };
}
