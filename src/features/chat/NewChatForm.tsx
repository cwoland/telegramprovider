import { useState, type FormEvent } from 'react';
import { useChat } from '../../store/chatContext';
import styles from './NewChatForm.module.css';

export function NewChatForm() {
    const { openChat } = useChat();
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setIsPending(true);
        const result = await openChat(value);
        setIsPending(false);

        if (result.ok) {
            setValue('');
            setError(null);
            return;
        }
        setError(result.error);
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.row}>
                <label className={styles.visuallyHidden} htmlFor="recipient">
                    Номер телефона получателя
                </label>
                <input
                    id="recipient"
                    className={styles.input}
                    value={value}
                    onChange={(event) => {
                        setValue(event.target.value);
                        setError(null);
                    }}
                    placeholder="+7 999 123-45-67"
                    inputMode="tel"
                    autoComplete="off"
                    disabled={isPending}
                    aria-invalid={error !== null}
                    aria-describedby={error === null ? undefined : 'recipient-error'}
                />
                <button
                    className={styles.submit}
                    type="submit"
                    disabled={isPending || value.trim() === ''}
                >
                    {isPending ? 'Ищем…' : 'Создать'}
                </button>
            </div>
            {error !== null && (
                <p id="recipient-error" className={styles.error} role="alert">{error}</p>
            )}
        </form>
    );
}