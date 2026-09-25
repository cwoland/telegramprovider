import { useEffect, useRef } from 'react';
import { GreenApiError, isAbortError, type GreenApiClient } from '../api/greenApi';
import type { NotificationBody } from '../api/types';

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 10_000;

function backoffFor(error: unknown, failures: number): number {
    if (error instanceof GreenApiError && error.status === 429) return RATE_LIMIT_BACKOFF_MS;
    return Math.min(BASE_BACKOFF_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal.aborted) {
            resolve();
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                resolve();
            },
            { once: true },
        );
    });
}

export interface UseNotificationPollingParams {
    client: GreenApiClient | null;
    enabled: boolean;
    onNotification: (body: NotificationBody) => void;
    onError?: (error: unknown) => void;
}

export function useNotificationPolling({
    client,
    enabled,
    onNotification,
    onError,
}: UseNotificationPollingParams): void {
    const onNotificationRef = useRef(onNotification);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onNotificationRef.current = onNotification;
        onErrorRef.current = onError;
    });

    useEffect(() => {
        if (!client || !enabled) return;

        const controller = new AbortController();
        const { signal } = controller;
        let failures = 0;

        const poll = async(): Promise<void> => {
            while (!signal.aborted) {
                try {
                    const notification = await client.receiveNotification({ signal });
                    failures = 0;

                    if (notification === null) continue;

                    try {
                        onNotificationRef.current(notification.body);
                    } finally {
                        await client.deleteNotification(notification.receiptId, { signal });
                    }
                } catch (error) {
                    if (signal.aborted || isAbortError(error)) return;
                    failures += 1;
                    onErrorRef.current?.(error);
                    await delay(backoffFor(error, failures), signal);
                }
            }
        };

        void poll();

        return () => {
            controller.abort();
        };
    }, [client, enabled]);
}