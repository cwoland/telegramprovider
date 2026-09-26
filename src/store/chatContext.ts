import { createContext, useContext } from 'react';
import type { Chat, ChatMessage, Credentials } from '../types';

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface ChatContextValue {
    credentials: Credentials | null;
    chats: Chat[];
    activeChatId: string | null;
    messages: ChatMessage[];
    error: string | null;

    login(credentials: Credentials): Promise<ActionResult>;
    logout(): void;
    openChat(recipient: string): Promise<ActionResult>;
    selectChat(chatId: string): void;
    closeChat(): void;
    sendMessage(text: string): Promise<void>;
    retryMessage(message: ChatMessage): Promise<void>;
    dismissError(): void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
    const value = useContext(ChatContext);
    if (value === null) {
        throw new Error('useChat() можно вызвать только внутри <ChatProvider>');
    }
    return value;
}
