import type { Credentials } from '../types';

const CREDENTIALS_KEY = 'greenapi:credentials';

function isCredentials(value: unknown): value is Credentials {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.apiUrl === 'string' &&
        typeof candidate.idInstance === 'string' &&
        typeof candidate.apiTokenInstance === 'string'
    );
}

export function loadCredentials(): Credentials | null {
    try {
        const raw = window.localStorage.getItem(CREDENTIALS_KEY);
        if (raw === null) return null;
        const parsed: unknown = JSON.parse(raw);
        return isCredentials(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function saveCredentials(credentials: Credentials): void {
    try {
        window.localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
    } catch {
        ///
    }
}

export function clearCredentials(): void {
    try {
        window.localStorage.removeItem(CREDENTIALS_KEY);
    } catch {
        ///
    }
}