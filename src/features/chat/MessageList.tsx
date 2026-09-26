import { useEffect, useRef } from 'react';
import { useChat } from '../../store/chatContext';
import type { ChatMessage } from '../../types';
import styles from './MessageList.module.css';

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dayWithYearFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

const STICK_THRESHOLD_PX = 120;
const GROUP_GAP_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABELS: Record<ChatMessage['status'], string> = {
    pending: 'отправляется',
    sent: 'отправлено',
    delivered: 'доставлено',
    read: 'прочитано',
    failed: 'не отправлено',
};

const STATUS_SYMBOLS: Record<ChatMessage['status'], string> = {
    pending: '◌',
    sent: '✓',
    delivered: '✓✓',
    read: '✓✓',
    failed: '!',
};

function startOfDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function formatDay(timestamp: number): string {
    const today = startOfDay(Date.now());
    const day = startOfDay(timestamp);

    if (day === today) return 'Сегодня';
    if (day === today - DAY_MS) return 'Вчера';

    const isSameYear = new Date(day).getFullYear() === new Date(today).getFullYear();
    return isSameYear ? dayFormatter.format(day) : dayWithYearFormatter.format(day);
}

function isGrouped(previous: ChatMessage | undefined, current: ChatMessage | undefined): boolean {
    if (previous === undefined || current === undefined) return false;
    if (previous.direction !== current.direction) return false;
    if (startOfDay(previous.timestamp) !== startOfDay(current.timestamp)) return false;
    return current.timestamp - previous.timestamp < GROUP_GAP_MS;
}

export function MessageList() {
    const { messages, activeChatId, chats, retryMessage } = useChat();
    const containerRef = useRef<HTMLDivElement>(null);
    const shouldStickRef = useRef(true);

    useEffect(() => {
        const container = containerRef.current;
        if (container === null || !shouldStickRef.current) return;
        container.scrollTop = container.scrollHeight;
    }, [messages]);

    useEffect(() => {
        shouldStickRef.current = true;
    }, [activeChatId]);

    const handleScroll = () => {
        const container = containerRef.current;
        if (container === null) return;
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        shouldStickRef.current = distanceToBottom < STICK_THRESHOLD_PX;
    };

    const activeChat = chats.find((chat) => chat.chatId === activeChatId) ?? null;

    if (messages.length === 0) {
        return (
            <div className={styles.list} role="log" aria-label="История сообщений">
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>Сообщений пока нет</p>
                    <p className={styles.emptyHint}>
                        Напишите первое сообщение{activeChat === null ? '' : ' — пользователь'}{' '}
                        получит его в Telegram.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={styles.list}
            ref={containerRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-label="История сообщений"
        >
            {messages.map((message, index) => {
                const previous: ChatMessage | undefined = messages[index - 1];
                const next: ChatMessage | undefined = messages[index + 1];

                const groupedWithPrevious = isGrouped(previous, message);
                const groupedWithNext = isGrouped(message, next);
                const showDay =
                    previous === undefined ||
                    startOfDay(previous.timestamp) !== startOfDay(message.timestamp);

                const isOutgoing = message.direction === 'outgoing';
                const showFooter = !groupedWithNext || message.status === 'failed';

                return (
                    <div key={message.id} className={styles.slot}>
                        {showDay && (
                            <div className={styles.daySeparator}>
                                <span className={styles.dayLabel}>{formatDay(message.timestamp)}</span>
                            </div>
                        )}
                        <div
                            className={styles.row}
                            data-direction={message.direction}
                            data-grouped={groupedWithPrevious}
                            data-tail={showFooter}
                        >
                            <div className={styles.bubble} data-failed={message.status === 'failed'}>
                                <p className={styles.text}>{message.text}</p>
                                {showFooter && (
                                    <span className={styles.meta}>
                                        <time dateTime={new Date(message.timestamp).toISOString()}>
                                            {timeFormatter.format(message.timestamp)}
                                        </time>
                                        {isOutgoing && (
                                            <span
                                                className={styles.status}
                                                data-status={message.status}
                                                aria-label={STATUS_LABELS[message.status]}
                                            >
                                                {STATUS_SYMBOLS[message.status]}
                                            </span>
                                        )}
                                    </span>
                                )}
                                {message.status === 'failed' && (
                                    <button
                                        className={styles.retry}
                                        type="button"
                                        onClick={() => void retryMessage(message)}
                                    >
                                        Повторить отправку
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
