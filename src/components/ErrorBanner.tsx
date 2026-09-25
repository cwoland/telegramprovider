import styles from './ErrorBanner.module.css';

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className={styles.banner} role="alert">
      <span className={styles.text}>{message}</span>
      <button className={styles.close} type="button" onClick={onDismiss} aria-label="Скрыть ошибку">
        ×
      </button>
    </div>
  );
}