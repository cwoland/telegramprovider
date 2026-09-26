import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import { chatReducer, initialChatState, type ChatState } from './chatReducer';

const CHAT_ID = '1777771364';

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: 'm1',
        chatId: CHAT_ID,
        text: 'привет',
        direction: 'outgoing',
        timestamp: 1_000,
        status: 'sent',
        ...overrides,
    };
}

function stateWithChat(): ChatState {
    return chatReducer(initialChatState, {
        type: 'chat/opened',
        payload: { chat: { chatId: CHAT_ID, title: '+7 (999) 123-45-67' } },
    });
}

describe('chat/opened', () => {
    it('создаёт чат и делает его активным', () => {
        const state = stateWithChat();
        expect(state.chats).toEqual([{ chatId: CHAT_ID, title: '+7 (999) 123-45-67' }]);
        expect(state.activeChatId).toBe(CHAT_ID);
    });

    it('не дублирует чат и не перезаписывает заголовок', () => {
        const state = chatReducer(stateWithChat(), {
            type: 'chat/opened',
            payload: { chat: { chatId: CHAT_ID, title: 'другое имя' } },
        });
        expect(state.chats).toHaveLength(1);
        expect(state.chats[0].title).toBe('+7 (999) 123-45-67');
    });
});

describe('chat/avatar', () => {
    it('обновляет только нужный чат', () => {
        const withSecond = chatReducer(stateWithChat(), {
            type: 'chat/opened',
            payload: { chat: { chatId: 'other', title: 'Другой' } },
        });

        const state = chatReducer(withSecond, {
            type: 'chat/avatar',
            payload: { chatId: CHAT_ID, avatarUrl: 'https://cdn/a.jpg' },
        });

        expect(state.chats.find((chat) => chat.chatId === CHAT_ID)?.avatarUrl).toBe(
            'https://cdn/a.jpg',
        );
        expect(state.chats.find((chat) => chat.chatId === 'other')?.avatarUrl).toBeUndefined();
    });
});

describe('отправка сообщения', () => {
    it('заменяет локальный id на серверный и ставит статус sent', () => {
        const queued = chatReducer(stateWithChat(), {
            type: 'message/queued',
            payload: { message: message({ id: 'local-1', status: 'pending' }) },
        });

        const sent = chatReducer(queued, {
            type: 'message/sent',
            payload: { chatId: CHAT_ID, localId: 'local-1', idMessage: 'srv-1' },
        });

        expect(sent.messagesByChat[CHAT_ID]).toEqual([message({ id: 'srv-1', status: 'sent' })]);
    });

    it('помечает сообщение как failed, не теряя текст', () => {
        const queued = chatReducer(stateWithChat(), {
            type: 'message/queued',
            payload: { message: message({ id: 'local-1', status: 'pending' }) },
        });

        const failed = chatReducer(queued, {
            type: 'message/failed',
            payload: { chatId: CHAT_ID, localId: 'local-1' },
        });

        expect(failed.messagesByChat[CHAT_ID]).toEqual([message({ id: 'local-1', status: 'failed' })]);
    });

    it('возвращает сообщение в pending при повторе', () => {
        const failed = chatReducer(stateWithChat(), {
            type: 'message/queued',
            payload: { message: message({ id: 'local-1', status: 'failed' }) },
        });

        const retried = chatReducer(failed, {
            type: 'message/retry',
            payload: { chatId: CHAT_ID, localId: 'local-1' },
        });

        expect(retried.messagesByChat[CHAT_ID][0].status).toBe('pending');
    });

    it('игнорирует message/sent для неизвестного localId', () => {
        const state = stateWithChat();
        expect(
            chatReducer(state, {
                type: 'message/sent',
                payload: { chatId: CHAT_ID, localId: 'нет такого', idMessage: 'srv-1' },
            }),
        ).toBe(state);
    });
});

describe('дедупликация', () => {
    it('не дублирует сообщение, пришедшее в уведомлении дважды', () => {
        const received = chatReducer(stateWithChat(), {
            type: 'message/received',
            payload: { message: message({ id: 'srv-1', direction: 'incoming' }) },
        });
        const again = chatReducer(received, {
            type: 'message/received',
            payload: { message: message({ id: 'srv-1', direction: 'incoming' }) },
        });

        expect(again.messagesByChat[CHAT_ID]).toHaveLength(1);
    });

    it('схлопывает эхо уведомления, обогнавшее ответ sendMessage', () => {
        const queued = chatReducer(stateWithChat(), {
            type: 'message/queued',
            payload: { message: message({ id: 'local-1', status: 'pending' }) },
        });
        const echoed = chatReducer(queued, {
            type: 'message/received',
            payload: { message: message({ id: 'srv-1', status: 'sent' }) },
        });

        expect(echoed.messagesByChat[CHAT_ID]).toHaveLength(2);

        const settled = chatReducer(echoed, {
            type: 'message/sent',
            payload: { chatId: CHAT_ID, localId: 'local-1', idMessage: 'srv-1' },
        });

        expect(settled.messagesByChat[CHAT_ID]).toEqual([message({ id: 'srv-1', status: 'sent' })]);
    });
});

describe('статусы доставки', () => {
    function withSentMessage(): ChatState {
        return chatReducer(stateWithChat(), {
            type: 'message/queued',
            payload: { message: message({ id: 'srv-1', status: 'sent' }) },
        });
    }

    it('повышает статус до read', () => {
        const delivered = chatReducer(withSentMessage(), {
            type: 'message/status',
            payload: { idMessage: 'srv-1', status: 'delivered', chatId: CHAT_ID },
        });
        const read = chatReducer(delivered, {
            type: 'message/status',
            payload: { idMessage: 'srv-1', status: 'read', chatId: CHAT_ID },
        });

        expect(read.messagesByChat[CHAT_ID][0].status).toBe('read');
    });

    it('не понижает статус уведомлением, пришедшим не по порядку', () => {
        const read = chatReducer(withSentMessage(), {
            type: 'message/status',
            payload: { idMessage: 'srv-1', status: 'read', chatId: CHAT_ID },
        });
        const late = chatReducer(read, {
            type: 'message/status',
            payload: { idMessage: 'srv-1', status: 'delivered', chatId: CHAT_ID },
        });

        expect(late.messagesByChat[CHAT_ID][0].status).toBe('read');
    });

    it('находит сообщение без chatId в уведомлении', () => {
        const state = chatReducer(withSentMessage(), {
            type: 'message/status',
            payload: { idMessage: 'srv-1', status: 'delivered' },
        });

        expect(state.messagesByChat[CHAT_ID][0].status).toBe('delivered');
    });

    it('игнорирует статус для неизвестного сообщения', () => {
        const state = withSentMessage();
        expect(
            chatReducer(state, {
                type: 'message/status',
                payload: { idMessage: 'нет такого', status: 'read' },
            }),
        ).toBe(state);
    });

    it('эхо со статусом sent не откатывает уже доставленное сообщение', () => {
        const delivered = chatReducer(withSentMessage(), {
            type: 'message/status',
            payload: { idMessage: 'srv-1', status: 'delivered', chatId: CHAT_ID },
        });

        const echoed = chatReducer(delivered, {
            type: 'message/received',
            payload: { message: message({ id: 'srv-1', status: 'sent' }) },
        });

        expect(echoed.messagesByChat[CHAT_ID][0].status).toBe('delivered');
    });
});

describe('message/received', () => {
    it('создаёт чат, если собеседник написал первым', () => {
        const state = chatReducer(initialChatState, {
            type: 'message/received',
            payload: {
                message: message({ id: 'srv-1', direction: 'incoming' }),
                chatTitle: 'Иван',
            },
        });

        expect(state.chats).toEqual([{ chatId: CHAT_ID, title: 'Иван' }]);
        expect(state.messagesByChat[CHAT_ID]).toHaveLength(1);
    });

    it('сортирует сообщения по времени независимо от порядка прихода', () => {
        let state = stateWithChat();
        for (const [id, timestamp] of [
            ['c', 3_000],
            ['a', 1_000],
            ['b', 2_000],
        ] as const) {
            state = chatReducer(state, {
                type: 'message/received',
                payload: { message: message({ id, timestamp, direction: 'incoming' }) },
            });
        }

        expect(state.messagesByChat[CHAT_ID].map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });
});

describe('state/reset', () => {
    it('возвращает начальное состояние', () => {
        expect(chatReducer(stateWithChat(), { type: 'state/reset' })).toEqual(initialChatState);
    });
});
