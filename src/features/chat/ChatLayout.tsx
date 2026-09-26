import { Avatar } from '../../components/Avatar';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useChat } from '../../store/chatContext';
import { ChatList } from './ChatList';
import styles from './ChatLayout.module.css';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { NewChatForm } from './NewChatForm';

export function ChatLayout() {
    const { chats, activeChatId, error, logout, closeChat, dismissError } = useChat();
    const activeChat = chats.find((chat) => chat.chatId === activeChatId) ?? null;

    return (
        <div className={styles.layout} data-active={activeChat !== null}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <span className={styles.brand}>Чаты</span>
                    <button className={styles.logout} type="button" onClick={logout}>
                        Выйти
                    </button>
                </div>
                <NewChatForm />
                <ChatList />
            </aside>

            <main className={styles.main}>
                {activeChat === null ? (
                    <div className={styles.placeholder}>
                        <p className={styles.placeholderTitle}>Ни один чат не выбран</p>
                        <p className={styles.placeholderHint}>
                            Выберите чат слева или создайте новый по номеру телефона получателя.
                        </p>
                    </div>
                ) : (
                    <>
                        <header className={styles.mainHeader}>
                            <button
                                className={styles.back}
                                type="button"
                                onClick={closeChat}
                                aria-label="Назад к списку чатов"
                            >
                                ←
                            </button>
                            <Avatar
                                title={activeChat.title}
                                seed={activeChat.chatId}
                                url={activeChat.avatarUrl}
                                size="sm"
                            />
                            <h1 className={styles.chatTitle}>{activeChat.title}</h1>
                        </header>
                        {error !== null && <ErrorBanner message={error} onDismiss={dismissError} />}
                        <MessageList />
                        <MessageInput />
                    </>
                )}
            </main>
        </div>
    );
}
