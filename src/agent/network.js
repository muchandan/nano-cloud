import { WebSocket } from 'ws';

export class AgentClient {
  constructor(url, token, metadata, messageHandler) {
    this.url = url;
    this.token = token;
    this.metadata = metadata;
    this.messageHandler = messageHandler;
    this.ws = null;
    this.reconnectTimer = null;
    this.onOpen = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      if (this.onOpen) {
        this.onOpen();
      }
    });

    this.ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        this.messageHandler(data, this);
      } catch {
        console.error('[Network] Malformed packet received.');
      }
    });

    this.ws.on('close', () => {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', () => {
      // Silently handled; close event triggers reconnection
    });
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}

