export interface InstanceData {
    idInstance: number;
    wid: string;
    typeInstance: string;
}

export interface SenderData {
    chatId: string;
    chatName?: string;
    sender?: string;
    senderName?: string;
    senderContactName?: string;
}

export interface TextMessageData {
    textMessage: string;
    isForwarded?: boolean;
    forwardingScore?: number;
}

export interface ExtendedTextMessageData {
    text: string;
    title?: string;
    description?: string;
    previewType?: string;
    jpegThumbnail?: string;
    isForwarded?: boolean;
    forwardingScore?: number;
}

export interface MessageData {
    typeMessage: string;
    textMessageData?: TextMessageData;
    extendedTextMessageData?: ExtendedTextMessageData;
}

export interface NotificationBody {
    typeWebhook: string;
    instanceData?: InstanceData;
    timestamp?: number;
    idMessage?: string;
    senderData?: SenderData;
    messageData?: MessageData;
    stateInstance?: string;
    status?: string;
    chatId?: string;
}

export interface ReceiveNotificationResponse {
    receiptId: number;
    body: NotificationBody;
}

export interface SendMessageResponse {
    idMessage: string;
}

export type InstanceState = 
    | 'notAuthorized'
    | 'authorized'
    | 'blocked'
    | 'sleepMode'
    | 'starting'
    | 'yellowCard';

export interface StateInstanceResponse {
    stateInstance: InstanceState | string;
}

export interface DeleteNotificationResponse {
    result: boolean;
}

export interface InstanceSettings {
    webhookUrl?: string;
    incomingWebhook?: string;
    outgoingWebhook?: string;
    outgoingMessageWebhook?: string;
    outgoingAPIMessageWebhook?: string;
    stateWebhook?: string;
}

export type SettingsPatch = Partial<Record<keyof InstanceSettings, string>>;

export interface GetAvatarResponse {
    urlAvatar?: string;
}

export interface CheckAccountResponse {
    exist: boolean;
    chatId?: string;
    username?: string;
    phoneNumber?: number;
    fromCache?: boolean;
}
