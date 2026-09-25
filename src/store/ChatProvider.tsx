import { useCallback, useMemo, useReducer, useState, type ReactNode } from 'react';
import { GreenApiError, createGreenApiClient } from '../api/greenApi';
import { resolveChatTitle, toChatMessage } from '../api/notification';
import type { NotificationBody } from '../api/types';
import { useNotificationPolling } from '../hooks/useNotificationPolling';
import { chatIdToDigits, formatPhone, parseRecipient } from '../lib/phone';
import { clearCredentials, loadCredentials, saveCredentials } from '../lib/storage';
import type { ChatMessage, Credentials } from '../types';
import { ChatContext, type ActionResult, type ChatContextValue } from './chatContext';
import { chatReducer, initialChatState } from './chatReducer';

const NO_MESSAGES: ChatMessage[] = [];

const STATE_MESSAGES: Record<string, string> = {
    notAuthorized: 'Инстанс не авторизован, авторизируйтесь в личном кабинете GREEN-API',
    blocked: 'Инстанс заблокирован',
    sleepMode: 'Инстанс в спящем режиме: устройство в данный момент не в сети',
    starting: 'Инстанс запускается, попробуйте через несколько секунд',
    yellowCard: 'Инстанс ограничен',
};

let localIdCounter = 0;

function nextLocalId(): string {
    localIdCounter += 1;
    return `local-${Date.now()}-${localIdCounter}`;
}

function toErrorMessage(error: unknown): string {
    if (error instanceof GreenApiError) return error.message;
    if (error instanceof Error) return error.message;
    return 'Неизвестная ошибка';
}

function resolveTitle(body: NotificationBody, message: ChatMessage): string {
    const fallback = formatPhone(chatIdToDigits(message.chatId));
    if (message.direction !== 'incoming') return fallback;
    const name = resolveChatTitle(body);
    return name !== null && name !== message.chatId ? name : fallback;
}

export function ChatProvider({ children }: { children: ReactNode }) {
    const [credentials, setCredentials] = useState<Credentials | null>(loadCredentials);
    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const [error, setError] = useState<string | null>(null);

    const client = useMemo(
        () => (credentials === null ? null : createGreenApiClient(credentials)),
        [credentials],
    );

    const handleNotification = useCallback((body: NotificationBody) => {
        setError(null);

        const message = toChatMessage(body);
        if (message === null) return;

        dispatch({
            type: 'message/received',
            payload: { message, chatTitle: resolveTitle(body, message) },
        });
    }, []);

    const handlePollingError = useCallback((pollingError: unknown) => {
        setError(toErrorMessage(pollingError));
    }, []);

    useNotificationPolling({
        client,
        enabled: client !== null,
        onNotification: handleNotification,
        onError: handlePollingError,
    });

    const login = useCallback(async (next: Credentials): Promise<ActionResult> => {
        try {
            const { stateInstance } = await createGreenApiClient(next).getStateInstance();
            if (stateInstance !== 'authorized') {
                return {
                    ok: false,
                    error: STATE_MESSAGES[stateInstance] ?? `Инстанс в состоянии "${stateInstance}"`,
                };
            }
        } catch (loginError) {
            return { ok: false, error: toErrorMessage(loginError) };
        }

        saveCredentials(next);
        setCredentials(next);
        setError(null);
        return { ok: true };
    }, []);

    const logout = useCallback(() => {
        clearCredentials();
        setCredentials(null);
        setError(null);
        dispatch({ type: 'state/reset' });
    }, []);

    const openChat = useCallback((recipient: string): ActionResult => {
        const parsed = parseRecipient(recipient);
        if (!parsed.ok) return parsed;

        dispatch({
            type: 'chat/opened',
            payload: { chat: { chatId: parsed.chatId, title: parsed.display } },
        });
        return { ok: true };
    }, []);

    const selectChat = useCallback((chatId: string) => {
        dispatch({ type: 'chat/selected', payload: { chatId } });
    }, []);

    const { activeChatId } = state;

    const sendMessage = useCallback(
        async (text: string): Promise<void> => {
            const trimmed = text.trim();
            if (client === null || activeChatId === null || trimmed === '') return;

            const localId = nextLocalId();
            dispatch({
                type: 'message/queued',
                payload: {
                    message: {
                        id: localId,
                        chatId: activeChatId,
                        text: trimmed,
                        direction: 'outgoing',
                        timestamp: Date.now(),
                        status: 'pending',
                    },
                },
            });

            try {
                const { idMessage } = await client.sendMessage({ chatId: activeChatId, message: trimmed });
                dispatch({ type: 'message/sent', payload: { chatId: activeChatId, localId, idMessage } });
            } catch (sendError) {
                dispatch({ type: 'message/failed', payload: { chatId: activeChatId, localId } });
                setError(toErrorMessage(sendError));
            }
        },
        [client, activeChatId],
    );

    const dismissError = useCallback(() => {
        setError(null);
    }, []);

    const messages = useMemo(
        () => (activeChatId === null ? NO_MESSAGES : state.messagesByChat[activeChatId] ?? NO_MESSAGES),
        [activeChatId, state.messagesByChat],
    );

    const value = useMemo<ChatContextValue>(
        () => ({
            credentials,
            chats: state.chats,
            activeChatId,
            messages,
            error,
            login,
            logout,
            openChat,
            selectChat,
            sendMessage,
            dismissError,
        }),
        [
            credentials,
            state.chats,
            activeChatId,
            messages,
            error,
            login,
            logout,
            openChat,
            selectChat,
            sendMessage,
            dismissError,
        ],
    );

    return <ChatContext value={value}>{children}</ChatContext>;
}