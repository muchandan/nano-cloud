import { ERROR_CODES, MSG_TYPES } from '../shared/constants.js';
import crypto from 'crypto';

export function setupAuthGate(ws, secretToken, onSuccess) {
  let isAuthenticated = false;
  let connectionRole = null;
  let connectionId = null;

  const authTimeout = setTimeout(() => {
    if (!isAuthenticated) {
      ws.close(ERROR_CODES.TIMEOUT, 'Authentication Timeout');
    }
  }, 5000);

  const handleAuthMessage = (data) => {
    if (data.type !== MSG_TYPES.AUTH_REQ) return;

    if (data.token === secretToken) {
      isAuthenticated = true;
      clearTimeout(authTimeout);
      
      connectionRole = data.role;
      connectionId = data.id || crypto.randomUUID();

      ws.send(JSON.stringify({ 
        type: MSG_TYPES.AUTH_RES, 
        status: 'success', 
        id: connectionId 
      }));

      onSuccess(connectionRole, connectionId, data.metadata);
    } else {
      ws.close(ERROR_CODES.AUTH_FAILED, 'Invalid Token');
    }
  };

  return {
    isAuthed: () => isAuthenticated,
    getRole: () => connectionRole,
    getId: () => connectionId,
    processAuth: handleAuthMessage
  };
}
