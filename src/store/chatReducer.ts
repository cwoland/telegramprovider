import type { Chat, ChatMessage } from '../types';

export interface ChatState {
    chats: Chat[];
    messagesByChat: Record<string, ChatMessage[]>;
    activeChatId: string | null;
}

export const initialChatState: ChatState = {
    chats: [],
    messagesByChat: {},
    activeChatId: null,
};

export type ChatAction = 
    | { type: 'chat/opened'; payload: { chat: Chat } }
    | { type: 'chat/selected'; payload: { chatId: string } }
    | { type: 'chat/avatar'; payload: { chatId: string; avatarUrl: string } }
    | { type: 'chat/closed' }
    | { type: 'message/queued'; payload: { message: ChatMessage } }
    | {
        type: 'message/sent'; 
        payload: { chatId: string; localId: string; idMessage: string };
    }
    | { type: 'message/failed'; payload: { chatId: string; localId: string } }
    | { type: 'message/received'; payload: { message: ChatMessage; chatTitle?: string } }
    | { type: 'state/reset' };

function byTime(a: ChatMessage, b: ChatMessage): number {
    return a.timestamp === b.timestamp ? a.id.localeCompare(b.id) : a.timestamp - b.timestamp;
}

function upsertMessage(list: readonly ChatMessage[], message: ChatMessage): ChatMessage[] {
    const index = list.findIndex((item) => item.id === message.id);
    if (index === -1) {
        return [...list, message].sort(byTime);
    }
    const next = [...list];
    next[index] = { ...next[index], ...message };
    return next.sort(byTime);
}

function withMessages(
    state: ChatState,
    chatId: string,
    update: (list: readonly ChatMessage[]) => ChatMessage[],
): ChatState {
    return {
        ...state,
        messagesByChat: {
            ...state.messagesByChat,
            [chatId]: update(state.messagesByChat[chatId] ?? []),
        },
    };
}

function ensureChat(state: ChatState, chat: Chat): ChatState {
    if (state.chats.some((item) => item.chatId === chat.chatId))
        return state;
    return { ...state, chats: [...state.chats, chat] };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case 'chat/opened': {
            const { chat } = action.payload;
            return { ...ensureChat(state, chat), activeChatId: chat.chatId };
        }

        case 'chat/selected': 
            return { ...state, activeChatId: action.payload.chatId };

        case 'chat/avatar': {
            const { chatId, avatarUrl } = action.payload;
            return {
                ...state,
                chats: state.chats.map((chat) => chat.chatId === chatId ? { ...chat, avatarUrl } : chat),
            };
        }

        case 'chat/closed':
            return { ...state, activeChatId: null };
        
        case 'message/queued': {
            const { message } = action.payload;
            return withMessages(state, message.chatId, (list) => upsertMessage(list, message));
        }

        case 'message/sent': {
            const { chatId, localId, idMessage } = action.payload;
            const list = state.messagesByChat[chatId] ?? [];
            const local = list.find((item) => item.id === localId);
            if (!local) return state;

            const withoutLocal = list.filter((item) => item.id !== localId);
            return withMessages(state, chatId, () => upsertMessage(withoutLocal, { ...local, id: idMessage, status: 'sent' }),
            );
        }

        case 'message/failed': {
            const { chatId, localId } = action.payload;
            return withMessages(state, chatId, (list) => list.map((item) => (item.id === localId ? { ...item, status: 'failed' } : item)),
            );
        }

        case 'message/received': {
            const { message, chatTitle } = action.payload;
            const stateWithChat = ensureChat(state, {
                chatId: message.chatId,
                title: chatTitle ?? message.chatId,
            });
            return withMessages(stateWithChat, message.chatId, (list) => upsertMessage(list, message));
        }

        case 'state/reset':
            return initialChatState;
        
        default: 
            return state;
    }
}