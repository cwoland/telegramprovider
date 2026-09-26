export interface Credentials {
    apiUrl: string;
    idInstance: string;
    apiTokenInstance: string;
}

export type MessageDirection = 'incoming' | 'outgoing';

export type MessageStatus = 'failed' | 'pending' | 'sent' | 'delivered' | 'read';

export interface ChatMessage {
    id: string;
    chatId: string;
    text: string;
    direction: MessageDirection;
    timestamp: number;
    status: MessageStatus;
}

export interface Chat {
    chatId: string;
    title: string;
    avatarUrl?: string;
}
