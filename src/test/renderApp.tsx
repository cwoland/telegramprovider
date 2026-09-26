import { render } from '@testing-library/react';
import App from '../App';
import { ChatProvider } from '../store/ChatProvider';

export function renderApp() {
    return render(
        <ChatProvider>
            <App />
        </ChatProvider>,
    );
}
