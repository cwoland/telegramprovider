import { useState, type CSSProperties } from 'react';
import styles from './Avatar.module.css';

const AVATAR_HUES = [25, 70, 140, 190, 250, 300, 340];

function initials(title: string): string {
    const digits = title.replace(/\D/g, '');
    if (digits.length >= 2) return digits.slice(-2);
    return title.trim().slice(0, 2).toUpperCase() || '#';
}

function hueFor(seed: string): number {
    let sum = 0;
    for (let index = 0; index < seed.length; index += 1) {
        sum += seed.charCodeAt(index);
    }
    return AVATAR_HUES[sum % AVATAR_HUES.length];
}

export function Avatar({
    title,
    seed,
    url,
    size = 'md',
}: {
    title: string;
    seed: string;
    url?: string;
    size?: 'sm' | 'md';
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    const showImage = url !== undefined && url !== '' && url !== failedUrl;
    const style = { '--avatar-hue': hueFor(seed) } as CSSProperties;

    return (
        <span className={styles.avatar} data-size={size} style={style} aria-hidden="true">
            {showImage ? (
                <img
                    className={styles.image}
                    src={url}
                    alt=""
                    loading="lazy"
                    onError={() => setFailedUrl(url ?? null)}
                />
            ) : (
                initials(title)
            )}
        </span>
    );
}
