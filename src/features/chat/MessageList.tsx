import { useEffect, useRef } from 'react';
import { useChat } from '../../store/chatContext';
import type { ChatMessage } from '../../types';
import styles from './MessageList.module.css';

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

const STICK_THRESHOLD_PX = 120;

function statusLabel(message: ChatMessage): { symbol: string; label: string } | null {
  if (message.direction !== 'outgoing') return null;
  switch (message.status) {
    case 'pending':
      return { symbol: '◌', label: 'отправляется' };
    case 'failed':
      return { symbol: '!', label: 'не отправлено' };
    default:
      return { symbol: '✓', label: 'отправлено' };
  }
}

export function MessageList() {
    const { messages } = useChat();
    const containerRef = useRef<HTMLDivElement>(null);
    const shouldStickRef = useRef(true);

    useEffect(() => {
        const container = containerRef.current;
        if (container === null || !shouldStickRef.current) return;
        container.scrollTop = container.scrollHeight;
    }, [messages]);

    const handleScroll = () => {
        const container = containerRef.current;
        if (container === null) return;
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        shouldStickRef.current = distanceToBottom < STICK_THRESHOLD_PX;
    };

    return (
        <div 
            className={styles.list}
            ref={containerRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-label="История сообщений"
        >
            {messages.length === 0 ? (
                <p className={styles.empty}>Сообщений нет. Напишите первое.</p>
            ) : (
                messages.map((message) => {
                    const status = statusLabel(message);
                    return (
                        <div key={message.id} className={styles.row} data-direction={message.direction}>
                            <div className={styles.bubble} data-filled={message.status === 'failed'}>
                                <p className={styles.text}>{message.text}</p>
                                <span className={styles.meta}>
                                    <time dateTime={new Date(message.timestamp).toISOString()}>
                                        {timeFormatter.format(message.timestamp)}
                                    </time>
                                    {status !== null && <span aria-label={status.label}>{status.symbol}</span>}
                                </span>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}