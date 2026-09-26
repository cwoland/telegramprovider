import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveCredentials, saveHistory } from '../../lib/storage';
import {
    TEST_CHAT_ID,
    TEST_CREDENTIALS,
    TEST_PHONE,
    TEST_PHONE_DISPLAY,
    checkAccountHandler,
    endpoint,
    incomingTextNotification,
    notificationQueue,
    outgoingEchoNotification,
    statusNotification,
} from '../../test/greenApi';
import { renderApp } from '../../test/renderApp';
import { server } from '../../test/server';

beforeEach(() => {
    saveCredentials(TEST_CREDENTIALS);
});

async function createChat(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Номер телефона получателя'), TEST_PHONE);
    await user.click(screen.getByRole('button', { name: 'Создать' }));
    await screen.findByRole('heading', { name: TEST_PHONE_DISPLAY });
}

describe('сценарий из ТЗ', () => {
    it('создаёт чат по номеру, отправляет сообщение и показывает ответ получателя', async () => {
        const sent: unknown[] = [];
        const queue = notificationQueue();
        server.use(
            ...queue.handlers,
            http.post(endpoint('sendMessage'), async ({ request }) => {
                sent.push(await request.json());
                return HttpResponse.json({ idMessage: 'out-1' });
            }),
        );

        const user = userEvent.setup();
        renderApp();
        await createChat(user);

        await user.type(screen.getByLabelText('Текст сообщения'), 'Привет из теста');
        await user.click(screen.getByRole('button', { name: 'Отправить' }));

        expect(screen.getByText('Привет из теста')).toBeInTheDocument();

        await waitFor(() => {
            expect(sent).toEqual([{ chatId: TEST_CHAT_ID, message: 'Привет из теста' }]);
        });
        expect(await screen.findByLabelText('отправлено')).toBeInTheDocument();

        const receiptId = queue.push(
            incomingTextNotification({ text: 'И тебе привет', idMessage: 'in-1' }),
        );

        expect(await screen.findByText('И тебе привет')).toBeInTheDocument();
        await waitFor(() => {
            expect(queue.deleted).toEqual([receiptId]);
        });
    });

    it('ключует чат идентификатором из checkAccount, а не телефоном', async () => {
        const sent: { chatId: string }[] = [];
        server.use(
            http.post(endpoint('sendMessage'), async ({ request }) => {
                sent.push((await request.json()) as { chatId: string });
                return HttpResponse.json({ idMessage: 'out-1' });
            }),
        );

        const user = userEvent.setup();
        renderApp();
        await createChat(user);
        await user.type(screen.getByLabelText('Текст сообщения'), 'Привет');
        await user.click(screen.getByRole('button', { name: 'Отправить' }));

        await waitFor(() => {
            expect(sent[0]?.chatId).toBe(TEST_CHAT_ID);
        });
        expect(sent[0]?.chatId).not.toContain('@c.us');
    });

    it('не создаёт чат, если у номера нет Telegram', async () => {
        server.use(checkAccountHandler(TEST_CHAT_ID, false));

        const user = userEvent.setup();
        renderApp();
        await user.type(screen.getByLabelText('Номер телефона получателя'), TEST_PHONE);
        await user.click(screen.getByRole('button', { name: 'Создать' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('У этого номера нет Telegram');
        expect(screen.getByText('Здесь появятся чаты')).toBeInTheDocument();
    });

    it('не дублирует сообщение и чат, когда возвращается исходящее эхо', async () => {
        const queue = notificationQueue();
        server.use(
            ...queue.handlers,
            http.post(endpoint('sendMessage'), () => HttpResponse.json({ idMessage: 'out-1' })),
        );

        const user = userEvent.setup();
        renderApp();
        await createChat(user);
        await user.type(screen.getByLabelText('Текст сообщения'), 'Привет');
        await user.click(screen.getByRole('button', { name: 'Отправить' }));

        await screen.findByLabelText('отправлено');

        queue.push(
            outgoingEchoNotification({ text: 'Привет', idMessage: 'out-1', senderName: 'Мой инстанс' }),
        );

        await waitFor(() => {
            expect(queue.deleted).toHaveLength(1);
        });
        expect(screen.getAllByText('Привет')).toHaveLength(1);
        expect(screen.getByRole('heading', { name: TEST_PHONE_DISPLAY })).toBeInTheDocument();
    });

    it('показывает доставку и прочтение из outgoingMessageStatus', async () => {
        const queue = notificationQueue();
        server.use(
            ...queue.handlers,
            http.post(endpoint('sendMessage'), () => HttpResponse.json({ idMessage: 'out-1' })),
        );

        const user = userEvent.setup();
        renderApp();
        await createChat(user);
        await user.type(screen.getByLabelText('Текст сообщения'), 'Привет');
        await user.click(screen.getByRole('button', { name: 'Отправить' }));
        await screen.findByLabelText('отправлено');

        queue.push(statusNotification({ idMessage: 'out-1', status: 'delivered' }));
        expect(await screen.findByLabelText('доставлено')).toBeInTheDocument();

        queue.push(statusNotification({ idMessage: 'out-1', status: 'read' }));
        expect(await screen.findByLabelText('прочитано')).toBeInTheDocument();
    });

    it('помечает сообщение неотправленным и повторяет отправку по кнопке', async () => {
        let attempts = 0;
        server.use(
            http.post(endpoint('sendMessage'), () => {
                attempts += 1;
                return attempts === 1
                    ? new HttpResponse('Bad chatId', { status: 400 })
                    : HttpResponse.json({ idMessage: 'out-1' });
            }),
        );

        const user = userEvent.setup();
        renderApp();
        await createChat(user);
        await user.type(screen.getByLabelText('Текст сообщения'), 'Не дошло с первого раза');
        await user.click(screen.getByRole('button', { name: 'Отправить' }));

        expect(await screen.findByLabelText('не отправлено')).toBeInTheDocument();
        expect(await screen.findByRole('alert')).toHaveTextContent(/Некорректный запрос/);

        await user.click(screen.getByRole('button', { name: 'Повторить отправку' }));

        expect(await screen.findByLabelText('отправлено')).toBeInTheDocument();
        expect(attempts).toBe(2);
        expect(screen.getAllByText('Не дошло с первого раза')).toHaveLength(1);
    });

    it('запрашивает аватар по каноническому chatId, а не по телефону', async () => {
        const avatarCalls: unknown[] = [];
        server.use(
            http.post(endpoint('getAvatar'), async ({ request }) => {
                avatarCalls.push(await request.json());
                return HttpResponse.json({ urlAvatar: 'https://cdn.example/avatar.jpg' });
            }),
        );

        const user = userEvent.setup();
        renderApp();
        await createChat(user);

        await waitFor(() => {
            expect(avatarCalls).toEqual([{ chatId: TEST_CHAT_ID }]);
        });
    });
});

describe('восстановление и выход', () => {
    it('поднимает чаты и переписку из localStorage', async () => {
        saveHistory({
            idInstance: TEST_CREDENTIALS.idInstance,
            chats: [{ chatId: TEST_CHAT_ID, title: TEST_PHONE_DISPLAY }],
            messagesByChat: {
                [TEST_CHAT_ID]: [
                    {
                        id: 'old-1',
                        chatId: TEST_CHAT_ID,
                        text: 'Сообщение из прошлой сессии',
                        direction: 'incoming',
                        timestamp: Date.now() - 60_000,
                        status: 'sent',
                    },
                ],
            },
            activeChatId: TEST_CHAT_ID,
        });

        renderApp();

        expect(await screen.findByText('Сообщение из прошлой сессии')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: TEST_PHONE_DISPLAY })).toBeInTheDocument();
    });

    it('не поднимает историю другого инстанса', () => {
        saveHistory({
            idInstance: '9999999999',
            chats: [{ chatId: TEST_CHAT_ID, title: TEST_PHONE_DISPLAY }],
            messagesByChat: {},
            activeChatId: TEST_CHAT_ID,
        });

        renderApp();
        expect(screen.getByText('Здесь появятся чаты')).toBeInTheDocument();
    });

    it('очищает состояние и хранилище при выходе', async () => {
        const user = userEvent.setup();
        renderApp();
        await createChat(user);

        await user.click(screen.getByRole('button', { name: 'Выйти' }));

        expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
        expect(window.localStorage.getItem('greenapi:credentials')).toBeNull();
        expect(window.localStorage.getItem('greenapi:history')).toBeNull();
    });

    it('показывает заглушку, пока чат не выбран', () => {
        renderApp();
        expect(screen.getByText('Ни один чат не выбран')).toBeInTheDocument();
        expect(screen.getByText('Здесь появятся чаты')).toBeInTheDocument();
    });
});
