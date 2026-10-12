import { WebSocketServer } from 'ws';
import { FleetStore } from './store.js';
import { MessageRouter } from './router.js';
import { MSG_TYPES, ROLES, ERROR_CODES } from '../shared/constants.js';

export async function startRelayServer(port, dashboardSecret) {
  const wss = new WebSocketServer({ port });
  const store = new FleetStore();
  const router = new MessageRouter();

  await store.init();
  console.log(`[Relay] Server listening on port ${port}`);

  wss.on('connection', (ws) => {
    let isAuthenticated = false;
    let connectionRole = null;
    let connectionId = null;

    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        // -------------------------------------------------------------
        // UNPAIRED AGENT PIN REGISTRATION
        // -------------------------------------------------------------
        if (data.type === MSG_TYPES.ENROLL_INIT) {
          const pin = store.generateClaimPin(ws, data.metadata || {});
          ws.send(JSON.stringify({ type: MSG_TYPES.ENROLL_PIN_ISSUED, pin }));
          console.log(`[Relay] Device requested enrollment. Issued PIN: ${pin}`);
          return;
        }

        // -------------------------------------------------------------
        // DASHBOARD DEVICE CLAIM BY PIN
        // -------------------------------------------------------------
        if (data.type === MSG_TYPES.CLAIM_DEVICE) {
          if (!isAuthenticated || connectionRole !== ROLES.DASHBOARD) {
            ws.send(JSON.stringify({ type: MSG_TYPES.CLAIM_RES, success: false, error: 'Unauthorized.' }));
            return;
          }

          const result = await store.claimDeviceByPin(data.pin, data.customName);
          if (!result.success) {
            ws.send(JSON.stringify({ type: MSG_TYPES.CLAIM_RES, success: false, error: result.reason }));
            return;
          }

          // Issue permanent credentials down to the waiting agent
          result.pendingWs.send(JSON.stringify({
            type: MSG_TYPES.ENROLL_SUCCESS,
            deviceToken: result.deviceToken,
            deviceId: result.deviceId
          }));

          // Register agent in active router
          router.registerAgent(result.deviceId, result.pendingWs, result.metadata);
          console.log(`[Relay] Device successfully paired and enrolled: ${result.deviceId}`);

          ws.send(JSON.stringify({ type: MSG_TYPES.CLAIM_RES, success: true, deviceId: result.deviceId }));
          return;
        }

        // -------------------------------------------------------------
        // STANDARD AUTHENTICATION
        // -------------------------------------------------------------
        if (!isAuthenticated) {
          if (data.type === MSG_TYPES.AUTH_REQ) {
            // Dashboard login (Master PSK)
            if (data.role === ROLES.DASHBOARD && data.token === dashboardSecret) {
              isAuthenticated = true;
              connectionRole = ROLES.DASHBOARD;
              connectionId = 'dashboard-session';

              ws.send(JSON.stringify({ type: MSG_TYPES.AUTH_RES, status: 'success' }));
              router.registerDashboard(ws);
              console.log('[Relay] Dashboard session authenticated.');
              return;
            }

            // Agent login (Saved persistent device token)
            if (data.role === ROLES.AGENT && data.deviceToken) {
              const device = store.validateDeviceToken(data.deviceToken);
              if (device) {
                isAuthenticated = true;
                connectionRole = ROLES.AGENT;
                connectionId = device.id;

                ws.send(JSON.stringify({ type: MSG_TYPES.AUTH_RES, status: 'success', id: device.id }));
                router.registerAgent(device.id, ws, data.metadata || device);
                console.log(`[Relay] Registered Host Reconnected: ${device.id}`);
                return;
              }
            }
          }

          ws.close(ERROR_CODES.AUTH_FAILED, 'Invalid credentials');
          return;
        }

        // -------------------------------------------------------------
        // ROUTE AUTHENTICATED TRAFFIC
        // -------------------------------------------------------------
        router.routeMessage(data, connectionRole, connectionId);

      } catch (err) {
        console.error('[Relay] Error handling packet:', err.message);
      }
    });

    ws.on('close', () => {
      if (connectionRole === ROLES.AGENT && connectionId) {
        router.removeAgent(connectionId);
        console.log(`[Relay] Agent offline: ${connectionId}`);
      } else if (connectionRole === ROLES.DASHBOARD) {
        router.removeDashboard(ws);
      }
    });
  });
}

