import { useState, type FormEvent } from 'react';
import { DEFAULT_API_URL } from '../../api/greenApi';
import { useChat } from '../../store/chatContext';
import styles from './LoginForm.module.css';

interface FormFields {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

const EMPTY_FIELDS: FormFields = {
  apiUrl: DEFAULT_API_URL,
  idInstance: '',
  apiTokenInstance: '',
};

export function LoginForm() {
  const { login } = useChat();
  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const update = (key: keyof FormFields) => (event: { target: { value: string } }) => {
    setFields((previous) => ({ ...previous, [key]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const result = await login({
      apiUrl: fields.apiUrl.trim(),
      idInstance: fields.idInstance.trim(),
      apiTokenInstance: fields.apiTokenInstance.trim(),
    });

    setIsPending(false);
    if (!result.ok) setError(result.error);
  };

  const isIncomplete =
    fields.apiUrl.trim() === '' ||
    fields.idInstance.trim() === '' ||
    fields.apiTokenInstance.trim() === '';

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>Вход через GREEN-API</h1>
        <p className={styles.hint}>
          Параметры доступа находятся в личном кабинете{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            console.green-api.com
          </a>
          .
        </p>

        <label className={styles.field}>
          <span className={styles.label}>apiUrl</span>
          <input
            className={styles.input}
            name="apiUrl"
            value={fields.apiUrl}
            onChange={update('apiUrl')}
            disabled={isPending}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>idInstance</span>
          <input
            className={styles.input}
            name="idInstance"
            value={fields.idInstance}
            onChange={update('idInstance')}
            disabled={isPending}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>apiTokenInstance</span>
          <input
            className={styles.input}
            name="apiTokenInstance"
            type="password"
            value={fields.apiTokenInstance}
            onChange={update('apiTokenInstance')}
            disabled={isPending}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={isPending || isIncomplete}>
          {isPending ? 'Проверяем инстанс…' : 'Войти'}
        </button>

        <p className={styles.note}>
          Учётные данные хранятся только в этом браузере и отправляются напрямую в GREEN-API.
        </p>
      </form>
    </div>
  );
}