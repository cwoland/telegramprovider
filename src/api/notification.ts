import type { ChatMessage, MessageDirection, MessageStatus } from '../types';
import type { MessageData, NotificationBody } from './types';

const INCOMING_WEBHOOKS = ['incomingMessageReceived'] as const;
const OUTGOING_WEBHOOKS = ['outgoingMessageReceived', 'outgoingAPIMessageReceived'] as const;

const DELIVERY_STATUSES: Record<string, MessageStatus> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
    noAccount: 'failed',
    notInGroup: 'failed',
};

export interface StatusUpdate {
    idMessage: string;
    status: MessageStatus;
    chatId?: string;
}

export function toStatusUpdate(body: NotificationBody): StatusUpdate | null {
    if (body.typeWebhook !== 'outgoingMessageStatus') return null;
    if (!body.idMessage || body.status === undefined) return null;

    const status = DELIVERY_STATUSES[body.status];
    if (status === undefined) return null;

    return { idMessage: body.idMessage, status, chatId: body.chatId };
}

function resolveDirection(typeWebhook: string): MessageDirection | null {
    if ((INCOMING_WEBHOOKS as readonly string[]).includes(typeWebhook)) return 'incoming';
    if ((OUTGOING_WEBHOOKS as readonly string[]).includes(typeWebhook)) return 'outgoing';
    return null;
}

export function extractText(messageData: MessageData | undefined): string | null {
    if (!messageData) return null;

    if (messageData.typeMessage === 'textMessage') {
        const text = messageData.textMessageData?.textMessage;
        return typeof text === 'string' ? text : null;
    }

    if (messageData.typeMessage === 'extendedTextMessage') {
        const text = messageData.extendedTextMessageData?.text;
        return typeof text === 'string' ? text : null;
    }

    return null;
}

export function toChatMessage(body: NotificationBody): ChatMessage | null {
    const direction = resolveDirection(body.typeWebhook);
    if (!direction) return null;

    const text = extractText(body.messageData);
    if (text === null) return null;

    const chatId = body.senderData?.chatId ?? body.chatId;
    if (!chatId || !body.idMessage) return null;

    return {
        id: body.idMessage,
        chatId,
        text,
        direction,
        timestamp: (body.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
        status: 'sent',
    };
}

export function resolveChatTitle(body: NotificationBody): string | null {
    const { senderContactName, senderName, chatName, chatId } = body.senderData ?? {};
    return senderContactName || senderName || chatName || chatId || null;
}