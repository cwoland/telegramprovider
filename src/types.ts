export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export type MessageDirection = 'incoming' | 'outgoing';

export type MessageStatus = 'pending' | 'sent' | 'failed';

export interface ChatMessage {
  id: string;
  chatId: string;
  text: string;
  direction: MessageDirection;
  timestamp: number;
  status: MessageStatus;
}

export interface Chat {
  chatId: string;
  title: string;
  avatarUrl?: string;
}