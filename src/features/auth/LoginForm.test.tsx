import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { TEST_CREDENTIALS, authorizedHandler, endpoint, settingsHandler } from '../../test/greenApi';
import { renderApp } from '../../test/renderApp';
import { server } from '../../test/server';

async function fillCredentials(user: UserEvent) {
    await user.type(screen.getByLabelText('idInstance'), TEST_CREDENTIALS.idInstance);
    await user.type(screen.getByLabelText('apiTokenInstance'), TEST_CREDENTIALS.apiTokenInstance);
}

describe('LoginForm', () => {
    it('блокирует кнопку, пока не заполнены все поля', async () => {
        const user = userEvent.setup();
        renderApp();

        expect(screen.getByRole('button', { name: 'Войти' })).toBeDisabled();
        await user.type(screen.getByLabelText('idInstance'), '1101');
        expect(screen.getByRole('button', { name: 'Войти' })).toBeDisabled();
    });

    it('не пускает дальше, если инстанс не авторизован', async () => {
        server.use(authorizedHandler('notAuthorized'));

        const user = userEvent.setup();
        renderApp();
        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/не авторизован/i);
        expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
        expect(window.localStorage.getItem('greenapi:credentials')).toBeNull();
    });

    it('показывает понятную ошибку при неверном токене', async () => {
        server.use(http.get(endpoint('getStateInstance'), () => new HttpResponse('', { status: 401 })));

        const user = userEvent.setup();
        renderApp();
        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Неверные idInstance или apiTokenInstance',
        );
    });

    it('открывает чат и сохраняет учётные данные при authorized', async () => {
        const user = userEvent.setup();
        renderApp();
        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: 'Войти' }));

        expect(await screen.findByText('Чаты')).toBeInTheDocument();
        expect(window.localStorage.getItem('greenapi:credentials')).toContain(
            TEST_CREDENTIALS.idInstance,
        );
    });

    it('включает входящие уведомления, если они выключены на инстансе', async () => {
        const patches: unknown[] = [];
        server.use(
            settingsHandler({ incomingWebhook: 'no' }),
            http.post(endpoint('setSettings'), async ({ request }) => {
                patches.push(await request.json());
                return HttpResponse.json({ saveSettings: true });
            }),
        );

        const user = userEvent.setup();
        renderApp();
        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: 'Войти' }));

        expect(await screen.findByText('Чаты')).toBeInTheDocument();
        expect(patches).toEqual([
            {
                incomingWebhook: 'yes',
                outgoingMessageWebhook: 'yes',
                outgoingAPIMessageWebhook: 'yes',
            },
        ]);
    });

    it('не трогает настройки, когда они уже в порядке', async () => {
        const setSettings = vi.fn(() => HttpResponse.json({ saveSettings: true }));
        server.use(http.post(endpoint('setSettings'), setSettings));

        const user = userEvent.setup();
        renderApp();
        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: 'Войти' }));

        expect(await screen.findByText('Чаты')).toBeInTheDocument();
        expect(setSettings).not.toHaveBeenCalled();
    });

    it('отказывает, если на инстансе задан внешний webhookUrl', async () => {
        server.use(settingsHandler({ webhookUrl: 'https://example.com/hook' }));

        const user = userEvent.setup();
        renderApp();
        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/webhookUrl/);
        expect(window.localStorage.getItem('greenapi:credentials')).toBeNull();
    });
});
