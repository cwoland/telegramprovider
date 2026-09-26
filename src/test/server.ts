import { setupServer } from 'msw/node';
import {
    authorizedHandler,
    avatarHandler,
    checkAccountHandler,
    deleteNotificationHandler,
    idleQueueHandler,
    setSettingsHandler,
    settingsHandler,
} from './greenApi';

export const server = setupServer(
    idleQueueHandler(),
    deleteNotificationHandler(),
    settingsHandler(),
    setSettingsHandler(),
    avatarHandler(),
    checkAccountHandler(),
    authorizedHandler(),
);
