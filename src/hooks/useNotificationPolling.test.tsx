import { render, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { StrictMode, useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GreenApiError, createGreenApiClient } from '../api/greenApi';
import type { NotificationBody } from '../api/types';
import {
    TEST_CREDENTIALS,
    endpoint,
    incomingTextNotification,
    notificationQueue,
} from '../test/greenApi';
import { server } from '../test/server';
import { useNotificationPolling } from './useNotificationPolling';

function Harness({
    onNotification,
    onError,
}: {
    onNotification: (body: NotificationBody) => void;
    onError?: (error: unknown) => void;
}) {
    const client = useMemo(() => createGreenApiClient(TEST_CREDENTIALS), []);
    useNotificationPolling({ client, enabled: true, onNotification, onError });
    return null;
}

describe('useNotificationPolling', () => {
    it('держит один цикл опроса даже при двойном монтировании в StrictMode', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        let calls = 0;

        server.use(
            http.get(endpoint('receiveNotification'), async () => {
                calls += 1;
                inFlight += 1;
                maxInFlight = Math.max(maxInFlight, inFlight);
                await delay(20);
                inFlight -= 1;
                return HttpResponse.json(null);
            }),
        );

        render(
            <StrictMode>
                <Harness onNotification={vi.fn()} />
            </StrictMode>,
        );

        await waitFor(() => {
            expect(inFlight).toBe(0);
        });

        maxInFlight = 0;
        const baseline = calls;

        await waitFor(() => {
            expect(calls).toBeGreaterThanOrEqual(baseline + 3);
        });
        expect(maxInFlight).toBe(1);
    });

    it('обрабатывает уведомление один раз и удаляет его из очереди', async () => {
        const queue = notificationQueue();
        const receiptId = queue.push(incomingTextNotification({ text: 'привет' }));
        server.use(...queue.handlers);

        const onNotification = vi.fn();
        render(
            <StrictMode>
                <Harness onNotification={onNotification} />
            </StrictMode>,
        );

        await waitFor(() => {
            expect(queue.deleted).toEqual([receiptId]);
        });
        expect(onNotification).toHaveBeenCalledTimes(1);
    });

    it('удаляет уведомление, даже если обработчик упал', async () => {
        const queue = notificationQueue();
        const receiptId = queue.push(incomingTextNotification({ text: 'ядовитое' }));
        server.use(...queue.handlers);

        const onNotification = vi.fn(() => {
            throw new Error('упал маппер');
        });

        render(
            <StrictMode>
                <Harness onNotification={onNotification} onError={vi.fn()} />
            </StrictMode>,
        );

        await waitFor(() => {
            expect(queue.deleted).toEqual([receiptId]);
        });
    });

    it('сообщает об ошибке опроса и не крутится вплотную', async () => {
        let calls = 0;
        server.use(
            http.get(endpoint('receiveNotification'), () => {
                calls += 1;
                return new HttpResponse('', { status: 500 });
            }),
        );

        const onError = vi.fn();
        render(
            <StrictMode>
                <Harness onNotification={vi.fn()} onError={onError} />
            </StrictMode>,
        );

        await waitFor(() => {
            expect(onError).toHaveBeenCalled();
        });
        expect(onError.mock.calls[0][0]).toBeInstanceOf(GreenApiError);
        expect(calls).toBeLessThanOrEqual(2);
    });
});
