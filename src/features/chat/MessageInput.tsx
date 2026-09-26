import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_MESSAGE_LENGTH } from '../../api/greenApi';
import { useChat } from '../../store/chatContext';
import styles from './MessageInput.module.css';

const COUNTER_THRESHOLD = 200;

export function MessageInput() {
  const { sendMessage, activeChatId } = useChat();
  const [text, setText] = useState('');

  const trimmed = text.trim();
  const isTooLong = trimmed.length > MAX_MESSAGE_LENGTH;
  const canSend = trimmed !== '' && !isTooLong && activeChatId !== null;

  const submit = () => {
    if (!canSend) return;
    setText('');
    void sendMessage(trimmed);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  const remaining = MAX_MESSAGE_LENGTH - trimmed.length;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.visuallyHidden} htmlFor="message">
        Текст сообщения
      </label>
      <textarea
        id="message"
        className={styles.field}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Написать сообщение…"
        rows={1}
        aria-invalid={isTooLong}
      />
      {remaining < COUNTER_THRESHOLD && (
        <span className={styles.counter} data-over={isTooLong}>
          {remaining}
        </span>
      )}
      <button className={styles.send} type="submit" disabled={!canSend}>
        Отправить
      </button>
    </form>
  );
}