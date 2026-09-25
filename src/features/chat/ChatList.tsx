import { useChat } from '../../store/chatContext';
import { Avatar } from '../../components/Avatar';
import styles from './ChatList.module.css';

export function ChatList() {
    const { chats, activeChatId, selectChat } = useChat();

    if (chats.length === 0) {
        return <p className={styles.empty}>Чатов пока нет</p>;
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
                            <Avatar title={chat.title} url={chat.avatarUrl} />
                            <span className={styles.title}>{chat.title}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}