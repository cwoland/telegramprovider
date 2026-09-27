import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveCredentials, saveHistory } from '../../lib/storage';
import {
    TEST_CHAT_ID,
    TEST_CREDENTIALS,
    TEST_PHONE_DISPLAY,
    endpoint,
    notificationQueue,
} from '../../test/greenApi';
import { renderApp } from '../../test/renderApp';
import { server } from '../../test/server';

beforeEach(() => {
    saveCredentials(TEST_CREDENTIALS);
    saveHistory({
        idInstance: TEST_CREDENTIALS.idInstance,
        chats: [{ chatId: TEST_CHAT_ID, title: TEST_PHONE_DISPLAY }],
        messagesByChat: {},
        activeChatId: TEST_CHAT_ID,
    });
});

describe('индикатор соединения', () => {
    it('показывает «на связи» после успешного опроса', async () => {
        renderApp();
        expect(await screen.findByText('на связи')).toBeInTheDocument();
    });

    it('показывает «нет связи», когда опрос падает', async () => {
        server.use(
            http.get(endpoint('receiveNotification'), () => new HttpResponse('', { status: 500 })),
        );

        renderApp();
        expect(await screen.findByText('нет связи')).toBeInTheDocument();
    });

    it('гасит плашку ошибки, когда связь восстановилась', async () => {
        let shouldFail = true;
        server.use(
            http.get(endpoint('receiveNotification'), () =>
                shouldFail ? new HttpResponse('', { status: 500 }) : HttpResponse.json(null),
            ),
        );

        renderApp();
        expect(await screen.findByRole('alert')).toBeInTheDocument();

        shouldFail = false;

        expect(await screen.findByText('на связи', undefined, { timeout: 4000 })).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    it('сообщает о разлогине инстанса по stateInstanceChanged', async () => {
        const queue = notificationQueue();
        server.use(...queue.handlers);

        renderApp();
        await screen.findByText('на связи');

        queue.push({
            typeWebhook: 'stateInstanceChanged',
            timestamp: Math.floor(Date.now() / 1000),
            stateInstance: 'notAuthorized',
        });

        expect(await screen.findByRole('alert')).toHaveTextContent(/не авторизован/i);
    });
});

describe('индикатор набора текста', () => {
    it('шлёт sendTyping один раз на серию нажатий', async () => {
        const typingCalls: unknown[] = [];
        server.use(
            http.post(endpoint('sendTyping'), async ({ request }) => {
                typingCalls.push(await request.json());
                return new HttpResponse('');
            }),
        );

        const user = userEvent.setup();
        renderApp();

        await user.type(await screen.findByLabelText('Текст сообщения'), 'привет');

        await waitFor(() => {
            expect(typingCalls).toHaveLength(1);
        });
        expect(typingCalls[0]).toMatchObject({ chatId: TEST_CHAT_ID });
    });
});
