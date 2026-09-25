import { LoginForm } from './features/auth/LoginForm';
import { ChatLayout } from './features/chat/ChatLayout';
import { useChat } from './store/chatContext';

export default function App() {
    const { credentials } = useChat();
    return credentials === null ? <LoginForm /> : <ChatLayout />;
}