import type { Chat, ChatMessage, Credentials, MessageDirection, MessageStatus } from '../types';

const CREDENTIALS_KEY = 'greenapi:credentials';
const HISTORY_KEY = 'greenapi:history';

const MAX_CHATS = 30;
const MAX_MESSAGES_PER_CHAT = 200;

const DIRECTIONS: readonly MessageDirection[] = ['incoming', 'outgoing'];
const STATUSES: readonly MessageStatus[] = ['failed', 'pending', 'sent', 'delivered', 'read'];

export interface PersistedHistory {
    idInstance: string;
    chats: Chat[];
    messagesByChat: Record<string, ChatMessage[]>;
    activeChatId: string | null;
}

function isCredentials(value: unknown): value is Credentials {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.apiUrl === 'string' &&
        typeof candidate.idInstance === 'string' &&
        typeof candidate.apiTokenInstance === 'string'
    );
}

function isChat(value: unknown): value is Chat {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.chatId === 'string' &&
        typeof candidate.title === 'string' &&
        (candidate.avatarUrl === undefined || typeof candidate.avatarUrl === 'string')
    );
}

function isChatMessage(value: unknown): value is ChatMessage {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.chatId === 'string' &&
        typeof candidate.text === 'string' &&
        typeof candidate.timestamp === 'number' &&
        DIRECTIONS.includes(candidate.direction as MessageDirection) &&
        STATUSES.includes(candidate.status as MessageStatus)
    );
}

function isHistory(value: unknown): value is PersistedHistory {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;

    if (typeof candidate.idInstance !== 'string') return false;
    if (!Array.isArray(candidate.chats) || !candidate.chats.every(isChat)) return false;
    if (candidate.activeChatId !== null && typeof candidate.activeChatId !== 'string') return false;

    const byChat = candidate.messagesByChat;
    if (typeof byChat !== 'object' || byChat === null) return false;

    return Object.values(byChat as Record<string, unknown>).every(
        (list) => Array.isArray(list) && list.every(isChatMessage),
    );
}

export function loadCredentials(): Credentials | null {
    try {
        const raw = window.localStorage.getItem(CREDENTIALS_KEY);
        if (raw === null) return null;
        const parsed: unknown = JSON.parse(raw);
        return isCredentials(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function saveCredentials(credentials: Credentials): void {
    try {
        window.localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
    } catch {
        ///
    }
}

export function clearCredentials(): void {
    try {
        window.localStorage.removeItem(CREDENTIALS_KEY);
    } catch {
        ///
    }
}

export function loadHistory(idInstance: string): PersistedHistory | null {
    try {
        const raw = window.localStorage.getItem(HISTORY_KEY);
        if (raw === null) return null;

        const parsed: unknown = JSON.parse(raw);
        if (!isHistory(parsed) || parsed.idInstance !== idInstance) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function saveHistory(history: PersistedHistory): void {
    const chats = history.chats.slice(-MAX_CHATS);
    const keep = new Set(chats.map((chat) => chat.chatId));

    const messagesByChat: Record<string, ChatMessage[]> = {};
    for (const [chatId, list] of Object.entries(history.messagesByChat)) {
        if (keep.has(chatId)) {
            messagesByChat[chatId] = list.slice(-MAX_MESSAGES_PER_CHAT);
        }
    }

    try {
        window.localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify({ ...history, chats, messagesByChat }),
        );
    } catch {
        ///
    }
}

export function clearHistory(): void {
    try {
        window.localStorage.removeItem(HISTORY_KEY);
    } catch {
        ///
    }
}
