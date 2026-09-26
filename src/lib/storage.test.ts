import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import { clearHistory, loadHistory, saveHistory } from './storage';

const ID_INSTANCE = '1101123456';
const CHAT_ID = '1777771364';

function message(index: number): ChatMessage {
    return {
        id: `m${index}`,
        chatId: CHAT_ID,
        text: `сообщение ${index}`,
        direction: 'incoming',
        timestamp: index,
        status: 'sent',
    };
}

function history(messages: ChatMessage[]) {
    return {
        idInstance: ID_INSTANCE,
        chats: [{ chatId: CHAT_ID, title: '+7 (999) 123-45-67' }],
        messagesByChat: { [CHAT_ID]: messages },
        activeChatId: CHAT_ID,
    };
}

describe('история в localStorage', () => {
    it('сохраняет и восстанавливает', () => {
        saveHistory(history([message(1), message(2)]));

        const restored = loadHistory(ID_INSTANCE);
        expect(restored?.chats).toHaveLength(1);
        expect(restored?.messagesByChat[CHAT_ID]).toHaveLength(2);
        expect(restored?.activeChatId).toBe(CHAT_ID);
    });

    it('не отдаёт историю другого инстанса', () => {
        saveHistory(history([message(1)]));
        expect(loadHistory('9999999999')).toBeNull();
    });

    it('обрезает переписку до 200 последних сообщений', () => {
        const many = Array.from({ length: 250 }, (_, index) => message(index));
        saveHistory(history(many));

        const restored = loadHistory(ID_INSTANCE);
        expect(restored?.messagesByChat[CHAT_ID]).toHaveLength(200);
        expect(restored?.messagesByChat[CHAT_ID][0].id).toBe('m50');
    });

    it('выбрасывает переписку чатов, не попавших в срез', () => {
        saveHistory({
            ...history([message(1)]),
            messagesByChat: { [CHAT_ID]: [message(1)], 'забытый-чат': [message(2)] },
        });

        const restored = loadHistory(ID_INSTANCE);
        expect(Object.keys(restored?.messagesByChat ?? {})).toEqual([CHAT_ID]);
    });

    it('возвращает null на повреждённые данные вместо падения', () => {
        window.localStorage.setItem('greenapi:history', '{не json');
        expect(loadHistory(ID_INSTANCE)).toBeNull();

        window.localStorage.setItem(
            'greenapi:history',
            JSON.stringify({ idInstance: ID_INSTANCE, chats: [{ chatId: 1 }], messagesByChat: {} }),
        );
        expect(loadHistory(ID_INSTANCE)).toBeNull();
    });

    it('отбрасывает сообщение с неизвестным статусом', () => {
        window.localStorage.setItem(
            'greenapi:history',
            JSON.stringify({
                ...history([]),
                messagesByChat: { [CHAT_ID]: [{ ...message(1), status: 'что-то новое' }] },
            }),
        );

        expect(loadHistory(ID_INSTANCE)).toBeNull();
    });

    it('очищается', () => {
        saveHistory(history([message(1)]));
        clearHistory();
        expect(loadHistory(ID_INSTANCE)).toBeNull();
    });
});
