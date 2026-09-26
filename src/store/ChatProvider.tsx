import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { GreenApiError, createGreenApiClient } from '../api/greenApi';
import { resolveChatTitle, toChatMessage, toStatusUpdate } from '../api/notification';
import type { NotificationBody, SettingsPatch } from '../api/types';
import { useNotificationPolling } from '../hooks/useNotificationPolling';
import { chatIdToDigits, formatPhone, parseRecipient } from '../lib/phone';
import {
    clearCredentials,
    clearHistory,
    loadCredentials,
    loadHistory,
    saveCredentials,
    saveHistory,
} from '../lib/storage';
import type { ChatMessage, Credentials } from '../types';
import { ChatContext, type ActionResult, type ChatContextValue } from './chatContext';
import { chatReducer, initialChatState, type ChatState } from './chatReducer';

const NO_MESSAGES: ChatMessage[] = [];

const STATE_MESSAGES: Record<string, string> = {
    notAuthorized: 'Инстанс не авторизован, авторизируйтесь в личном кабинете GREEN-API',
    blocked: 'Инстанс заблокирован',
    sleepMode: 'Инстанс в спящем режиме: устройство в данный момент не в сети',
    starting: 'Инстанс запускается, попробуйте через несколько секунд',
    yellowCard: 'Инстанс ограничен',
};

const REQUIRED_SETTINGS: SettingsPatch = {
    incomingWebhook: 'yes',
    outgoingMessageWebhook: 'yes',
    outgoingAPIMessageWebhook: 'yes',
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

function createInitialState(credentials: Credentials | null): ChatState {
    if (credentials === null) return initialChatState;

    const restored = loadHistory(credentials.idInstance);
    if (restored === null) return initialChatState;

    return {
        chats: restored.chats,
        messagesByChat: restored.messagesByChat,
        activeChatId: restored.activeChatId,
    };
}

export function ChatProvider({ children }: { children: ReactNode }) {
    const [credentials, setCredentials] = useState<Credentials | null>(loadCredentials);
    const [state, dispatch] = useReducer(chatReducer, credentials, createInitialState);
    const [error, setError] = useState<string | null>(null);
    const avatarRequestRef = useRef(new Set<string>());

    const client = useMemo(
        () => (credentials === null ? null : createGreenApiClient(credentials)),
        [credentials],
    );

    useEffect(() => {
        if (credentials === null) return;

        saveHistory({
            idInstance: credentials.idInstance,
            chats: state.chats,
            messagesByChat: state.messagesByChat,
            activeChatId: state.activeChatId,
        });
    }, [credentials, state]);

    const loadAvatar = useCallback(
        (chatId: string) => {
            if (client === null || avatarRequestRef.current.has(chatId)) return;
            avatarRequestRef.current.add(chatId);

            void client
                .getAvatar(chatId)
                .then((avatarUrl) => {
                    if (avatarUrl !== null) {
                        dispatch({ type: 'chat/avatar', payload: { chatId, avatarUrl } });
                    }
                })
                .catch((avatarError: unknown) => {
                    console.warn('Не удалось получить аватар', chatId, avatarError);
                    avatarRequestRef.current.delete(chatId);
                });
        },
        [client],
    );

    const handleNotification = useCallback((body: NotificationBody) => {
        setError(null);

        const statusUpdate = toStatusUpdate(body);
        if (statusUpdate !== null) {
            dispatch({ type: 'message/status', payload: statusUpdate });
            return;
        }

        const message = toChatMessage(body);
        if (message === null) return;

        dispatch({
            type: 'message/received',
            payload: { message, chatTitle: resolveTitle(body, message) },
        });
        loadAvatar(message.chatId);
    }, [loadAvatar]);

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
        const probe = createGreenApiClient(next);

        try {
            const { stateInstance } = await probe.getStateInstance();
            if (stateInstance !== 'authorized') {
                return {
                    ok: false,
                    error: STATE_MESSAGES[stateInstance] ?? `Инстанс в состоянии «${stateInstance}»`,
                };
            }

            const settings = await probe.getSettings();

            if ((settings.webhookUrl ?? '').trim() !== '') {
                return {
                    ok: false,
                    error:
                        'В настройках инстанса задан webhookUrl — уведомления уходят на ваш сервер, ' +
                        'а не в очередь HTTP API. Очистите webhookUrl в личном кабинете GREEN-API.',
                };
            }

            const isMissing = Object.entries(REQUIRED_SETTINGS).some(
                ([key, value]) => settings[key as keyof typeof settings] !== value,
            );
            if (isMissing) {
                await probe.setSettings(REQUIRED_SETTINGS);
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
        clearHistory();
        setCredentials(null);
        setError(null);
        dispatch({ type: 'state/reset' });
        avatarRequestRef.current.clear();
    }, []);

    const openChat = useCallback(
        async (recipient: string): Promise<ActionResult> => {
            const parsed = parseRecipient(recipient);
            if (!parsed.ok) return parsed;
            if (client === null) return { ok: false, error: 'Нет активного подключения' };

            let account;
            try {
                account = await client.checkAccount(chatIdToDigits(parsed.chatId));
            } catch (checkError) {
                return { ok: false, error: toErrorMessage(checkError) };
            }

            if (!account.exist || !account.chatId) {
                return { ok: false, error: 'У этого номера нет Telegram' };
            }

            dispatch({
                type: 'chat/opened',
                payload: { chat: { chatId: account.chatId, title: parsed.display } },
            });
            loadAvatar(account.chatId);
            return { ok: true };
        },
        [client, loadAvatar],
    );

    const selectChat = useCallback(
        (chatId: string) => {
            dispatch({ type: 'chat/selected', payload: { chatId } });
            loadAvatar(chatId);
        },
        [loadAvatar],
    );

    const closeChat = useCallback(() => {
        dispatch({ type: 'chat/closed' });
    }, []);

    const { activeChatId } = state;

    const deliver = useCallback(
        async (chatId: string, localId: string, text: string): Promise<void> => {
            if (client === null) return;

            try {
                const { idMessage } = await client.sendMessage({ chatId, message: text });
                dispatch({ type: 'message/sent', payload: { chatId, localId, idMessage } });
            } catch (sendError) {
                dispatch({ type: 'message/failed', payload: { chatId, localId } });
                setError(toErrorMessage(sendError));
            }
        },
        [client],
    );

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

            await deliver(activeChatId, localId, trimmed);
        },
        [client, activeChatId, deliver],
    );

    const retryMessage = useCallback(
        async (message: ChatMessage): Promise<void> => {
            if (client === null || message.status !== 'failed') return;

            setError(null);
            dispatch({
                type: 'message/retry',
                payload: { chatId: message.chatId, localId: message.id },
            });

            await deliver(message.chatId, message.id, message.text);
        },
        [client, deliver],
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
            closeChat,
            sendMessage,
            retryMessage,
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
            closeChat,
            sendMessage,
            retryMessage,
            dismissError,
        ],
    );

    return <ChatContext value={value}>{children}</ChatContext>;
}
