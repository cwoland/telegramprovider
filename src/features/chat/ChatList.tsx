import { Avatar } from '../../components/Avatar';
import { useChat } from '../../store/chatContext';
import styles from './ChatList.module.css';

export function ChatList() {
    const { chats, activeChatId, selectChat } = useChat();

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
                {chats.map((chat) => (
                    <li key={chat.chatId}>
                        <button
                            className={styles.item}
                            type="button"
                            onClick={() => selectChat(chat.chatId)}
                            aria-current={chat.chatId === activeChatId}
                        >
                            <Avatar title={chat.title} seed={chat.chatId} url={chat.avatarUrl} />
                            <span className={styles.title}>{chat.title}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
