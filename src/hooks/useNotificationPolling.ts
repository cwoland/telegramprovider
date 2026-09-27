import { useEffect, useRef } from 'react';
import { GreenApiError, isAbortError, type GreenApiClient } from '../api/greenApi';
import type { NotificationBody } from '../api/types';

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 10_000;
const MIN_POLL_INTERVAL_MS = 250;

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

export type PollingStatus = 'connecting' | 'online' | 'offline';

export interface UseNotificationPollingParams {
    client: GreenApiClient | null;
    enabled: boolean;
    onNotification: (body: NotificationBody) => void;
    onError?: (error: unknown) => void;
    onStatusChange?: (status: PollingStatus) => void;
}

export function useNotificationPolling({
    client,
    enabled,
    onNotification,
    onError,
    onStatusChange,
}: UseNotificationPollingParams): void {
    const onNotificationRef = useRef(onNotification);
    const onErrorRef = useRef(onError);
    const onStatusChangeRef = useRef(onStatusChange);

    useEffect(() => {
        onNotificationRef.current = onNotification;
        onErrorRef.current = onError;
        onStatusChangeRef.current = onStatusChange;
    });

    useEffect(() => {
        if (!client || !enabled) return;

        const controller = new AbortController();
        const { signal } = controller;
        let failures = 0;
        let lastStatus: PollingStatus | null = null;

        const emit = (next: PollingStatus) => {
            if (lastStatus === next) return;
            lastStatus = next;
            onStatusChangeRef.current?.(next);
        };

        emit('connecting');

        const poll = async(): Promise<void> => {
            while (!signal.aborted) {
                try {
                    const startedAt = Date.now();
                    const notification = await client.receiveNotification({ signal });
                    failures = 0;
                    emit('online');

                    if (notification === null) {
                        const elapsed = Date.now() - startedAt;
                        if (elapsed < MIN_POLL_INTERVAL_MS) {
                            await delay(MIN_POLL_INTERVAL_MS - elapsed, signal);
                        }
                        continue;
                    }

                    try {
                        onNotificationRef.current(notification.body);
                    } finally {
                        await client.deleteNotification(notification.receiptId, { signal });
                    }
                } catch (error) {
                    if (signal.aborted || isAbortError(error)) return;
                    failures += 1;
                    emit('offline');
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