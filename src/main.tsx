import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ChatProvider } from './store/ChatProvider.tsx';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Не найден контейнер в index.html');
}

createRoot(container).render(
  <StrictMode>
    <ChatProvider>
      <App />
    </ChatProvider>
  </StrictMode>,
);
