/**
 * Tiny reconnecting WebSocket client for the commieD host.
 * It carries JSON only; all game rules stay on the server.
 */
export class NetClient {
  constructor({ url, onMessage, onStatus } = {}) {
    this.url = url;
    this.onMessage = onMessage ?? (() => {});
    this.onStatus = onStatus ?? (() => {});
    this.socket = null;
    this.open = false;
    this.closedByUser = false;
    this.joinPayload = null;
    this.retryTimer = null;
    this.retryMs = 1500;
  }

  connect() {
    this.closedByUser = false;
    this.onStatus('CONNECTING');

    let socket;

    try {
      socket = new WebSocket(this.url);
    } catch {
      this.onStatus('OFFLINE');
      this.#scheduleRetry();
      return;
    }

    this.socket = socket;
    socket.addEventListener('open', () => {
      this.open = true;
      this.retryMs = 1500;
      this.onStatus('ONLINE');
      if (this.joinPayload) {
        this.send({ type: 'join', ...this.joinPayload });
      }
    });

    socket.addEventListener('message', (event) => {
      let message;

      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      this.onMessage(message);
    });

    socket.addEventListener('close', () => {
      this.open = false;
      this.onStatus('OFFLINE');
      if (!this.closedByUser) {
        this.#scheduleRetry();
      }
    });

    socket.addEventListener('error', () => {
      this.onStatus('OFFLINE');
    });
  }

  send(message) {
    if (this.open && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  join(payload) {
    this.joinPayload = payload;
    this.send({ type: 'join', ...payload });
  }

  close() {
    this.closedByUser = true;
    window.clearTimeout(this.retryTimer);
    this.socket?.close();
  }

  #scheduleRetry() {
    if (this.retryTimer !== null) {
      return;
    }

    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.retryMs = Math.min(8000, this.retryMs * 1.5);
      this.connect();
    }, this.retryMs);
  }
}

export function defaultWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}
