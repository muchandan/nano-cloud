import { MSG_TYPES, ROLES } from '../shared/constants.js';

export class MessageRouter {
  constructor() {
    this.agents = new Map();
    this.dashboards = new Set();
  }

  registerAgent(id, ws, metadata) {
    this.agents.set(id, { ws, metadata });
    this.broadcastToDashboards({
      type: MSG_TYPES.AGENT_CONNECT,
      id,
      metadata
    });
  }

  registerDashboard(ws) {
    this.dashboards.add(ws);
    const activeAgents = Array.from(this.agents.entries()).map(([id, info]) => ({
      id,
      metadata: info.metadata
    }));
    ws.send(JSON.stringify({ type: MSG_TYPES.INIT_STATE, agents: activeAgents }));
  }

  removeAgent(id) {
    if (this.agents.has(id)) {
      this.agents.delete(id);
      this.broadcastToDashboards({ type: MSG_TYPES.AGENT_DISCONNECT, id });
    }
  }

  removeDashboard(ws) {
    this.dashboards.delete(ws);
  }

  broadcastToDashboards(payload) {
    const msg = JSON.stringify(payload);
    for (const dashboard of this.dashboards) {
      if (dashboard.readyState === 1 /* OPEN */) {
        dashboard.send(msg);
      }
    }
  }

  routeMessage(data, senderRole, senderId) {
    if (senderRole === ROLES.AGENT) {
      // Agents only send telemetry or file data up to dashboards
      const dashboardBoundTypes = [
        MSG_TYPES.TELEMETRY, 
        MSG_TYPES.FILE_LIST, 
        MSG_TYPES.FILE_DATA, 
        MSG_TYPES.CMD_ACK
      ];
      
      if (dashboardBoundTypes.includes(data.type)) {
        data.agentId = senderId;
        this.broadcastToDashboards(data);
      }
    } 
    else if (senderRole === ROLES.DASHBOARD) {
      // Dashboards only send commands down to specific agents
      if (data.targetId && this.agents.has(data.targetId)) {
        this.agents.get(data.targetId).ws.send(JSON.stringify(data));
      }
    }
  }
}
