import { Avatar } from '../../components/Avatar';
import { useChat } from '../../store/chatContext';
import type { ChatMessage } from '../../types';
import styles from './ChatList.module.css';

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });

const DAY_MS = 24 * 60 * 60 * 1000;

function formatStamp(timestamp: number): string {
    return Date.now() - timestamp < DAY_MS
        ? timeFormatter.format(timestamp)
        : dayFormatter.format(timestamp);
}

function preview(message: ChatMessage): string {
    const text = message.text.replace(/\s+/g, ' ').trim();
    return message.direction === 'outgoing' ? `Вы: ${text}` : text;
}

export function ChatList() {
    const { chats, activeChatId, lastMessages, selectChat } = useChat();

    if (chats.length === 0) {
        return (
            <div className={styles.empty}>
                <p className={styles.emptyTitle}>Здесь появятся чаты</p>
                <p className={styles.emptyHint}>
                    Введите номер телефона в поле выше и нажмите «Создать» — мы проверим, есть ли у
                    этого номера Telegram.
                </p>
            </div>
        );
    }

    return (
        <nav className={styles.nav} aria-label="Список чатов">
            <ul className={styles.list}>
                {chats.map((chat) => {
                    const last = lastMessages[chat.chatId];

                    return (
                        <li key={chat.chatId}>
                            <button
                                className={styles.item}
                                type="button"
                                onClick={() => selectChat(chat.chatId)}
                                aria-current={chat.chatId === activeChatId}
                            >
                                <Avatar title={chat.title} seed={chat.chatId} url={chat.avatarUrl} />
                                <span className={styles.body}>
                                    <span className={styles.head}>
                                        <span className={styles.title}>{chat.title}</span>
                                        {last !== undefined && (
                                            <time
                                                className={styles.time}
                                                dateTime={new Date(last.timestamp).toISOString()}
                                            >
                                                {formatStamp(last.timestamp)}
                                            </time>
                                        )}
                                    </span>
                                    <span className={styles.preview}>
                                        {last === undefined ? 'Нет сообщений' : preview(last)}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}