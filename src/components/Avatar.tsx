import { useState } from 'react';
import styles from './Avatar.module.css';

function initials(title: string): string {
    const digits = title.replace(/\D/g, '');
    if (digits.length >= 2) return digits.slice(-2);
    return title.trim().slice(0, 2).toUpperCase() || '#';
}

export function Avatar({
  title,
  url,
  size = 'md',
}: {
  title: string;
  url?: string;
  size?: 'sm' | 'md';
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const showImage = url !== undefined && url !== '' && url !== failedUrl;

  return (
    <span className={styles.avatar} data-size={size} aria-hidden="true">
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