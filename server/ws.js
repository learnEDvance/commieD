import { createHash } from 'node:crypto';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE_BYTES = 1_000_000;

export const OPCODE = Object.freeze({
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
});

export function websocketAccept(key) {
  return createHash('sha1').update(`${key}${WEBSOCKET_GUID}`).digest('base64');
}

function encodeLength(length) {
  if (length < 126) {
    return { marker: length, extra: Buffer.alloc(0) };
  }
  if (length < 65_536) {
    const extra = Buffer.alloc(2);
    extra.writeUInt16BE(length, 0);
    return { marker: 126, extra };
  }
  const extra = Buffer.alloc(8);
  extra.writeBigUInt64BE(BigInt(length), 0);
  return { marker: 127, extra };
}

/** Encode one frame. Servers send unmasked; tests can request a mask. */
export function encodeFrame(opcode, payload = Buffer.alloc(0), { mask = false, fin = true } = {}) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const { marker, extra } = encodeLength(body.length);
  const maskBit = mask ? 0x80 : 0;
  const header = Buffer.alloc(2 + extra.length);
  header[0] = (fin ? 0x80 : 0) | opcode;
  header[1] = maskBit | marker;
  extra.copy(header, 2);

  if (!mask) {
    return Buffer.concat([header, body]);
  }

  const key = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const masked = Buffer.alloc(body.length);
  for (let index = 0; index < body.length; index += 1) {
    masked[index] = body[index] ^ key[index % 4];
  }

  const headerWithMask = Buffer.concat([header, key]);
  return Buffer.concat([headerWithMask, masked]);
}

export function encodeText(text) {
  return encodeFrame(OPCODE.TEXT, Buffer.from(String(text), 'utf8'));
}

export function encodePong(payload) {
  return encodeFrame(OPCODE.PONG, payload);
}

export function encodeClose(code = 1000, reason = '') {
  const reasonBuffer = Buffer.from(reason, 'utf8');
  const payload = Buffer.alloc(2 + reasonBuffer.length);
  payload.writeUInt16BE(code, 0);
  reasonBuffer.copy(payload, 2);
  return encodeFrame(OPCODE.CLOSE, payload);
}

/**
 * Incremental WebSocket frame decoder.
 *
 * Client frames are masked. Fragmented text/binary messages are joined until
 * the FIN frame. Control frames are emitted immediately and are never joined.
 */
export class FrameDecoder {
  constructor({ maxMessageBytes = MAX_MESSAGE_BYTES } = {}) {
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentBytes = 0;
    this.fragmentOpcode = null;
    this.maxMessageBytes = maxMessageBytes;
  }

  push(chunk) {
    if (chunk && chunk.length > 0) {
      this.buffer = Buffer.concat([this.buffer, chunk]);
    }

    const messages = [];

    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const fin = (first & 0x80) !== 0;
      const rsv = first & 0x70;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;

      if (rsv !== 0) {
        throw new RangeError('WebSocket extensions are not supported');
      }
      if (!masked) {
        throw new RangeError('Client frames must be masked');
      }

      if (length === 126) {
        if (this.buffer.length < offset + 2) {
          break;
        }
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) {
          break;
        }
        const big = this.buffer.readBigUInt64BE(offset);
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new RangeError('WebSocket frame is too large');
        }
        length = Number(big);
        offset += 8;
      }

      if (length > this.maxMessageBytes) {
        throw new RangeError('WebSocket message is too large');
      }
      if (this.buffer.length < offset + 4) {
        break;
      }

      const key = this.buffer.subarray(offset, offset + 4);
      offset += 4;

      if (this.buffer.length < offset + length) {
        break;
      }

      const payload = Buffer.alloc(length);
      const source = this.buffer.subarray(offset, offset + length);
      for (let index = 0; index < length; index += 1) {
        payload[index] = source[index] ^ key[index % 4];
      }
      this.buffer = this.buffer.subarray(offset + length);

      const isControl = (opcode & 0x8) !== 0;
      if (isControl) {
        if (!fin) {
          throw new RangeError('Control frames cannot be fragmented');
        }
        messages.push({ opcode, payload, fin: true });
        continue;
      }

      if (opcode === OPCODE.CONTINUATION) {
        if (this.fragmentOpcode === null) {
          throw new RangeError('Unexpected continuation frame');
        }
        this.fragments.push(payload);
        this.fragmentBytes += payload.length;

        if (this.fragmentBytes > this.maxMessageBytes) {
          throw new RangeError('WebSocket message is too large');
        }
        if (fin) {
          const joined = Buffer.concat(this.fragments);
          const type = this.fragmentOpcode;
          this.fragments = [];
          this.fragmentBytes = 0;
          this.fragmentOpcode = null;
          messages.push({ opcode: type, payload: joined, fin: true });
        }
        continue;
      }

      if (this.fragmentOpcode !== null) {
        throw new RangeError('New data frame started before the previous one finished');
      }

      if (fin) {
        messages.push({ opcode, payload, fin: true });
      } else {
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
        this.fragmentBytes = payload.length;
      }
    }

    return messages;
  }
}

/** Small wrapper around a socket that speaks WebSocket frames. */
export class WebSocketConnection {
  constructor(socket, head = null, { onMessage, onClose } = {}) {
    this.socket = socket;
    this.decoder = new FrameDecoder();
    this.open = true;
    this.closedNotified = false;
    this.onMessage = onMessage ?? null;
    this.onClose = onClose ?? (() => {});
    this.pendingMessages = [];
    this.remoteAddress = socket.remoteAddress;

    socket.on('data', (chunk) => this.#receive(chunk));
    socket.on('error', () => this.close(1006, 'socket error'));
    socket.on('close', () => this.#closed());
    socket.setNoDelay?.(true);
    socket.setTimeout?.(0);

    if (head && head.length > 0) {
      this.#receive(head);
    }
  }

  sendJson(value) {
    this.sendText(JSON.stringify(value));
  }

  setMessageHandler(handler) {
    this.onMessage = handler;
    const pending = this.pendingMessages.splice(0, this.pendingMessages.length);
    for (const payload of pending) {
      handler(payload);
    }
  }

  sendText(text) {
    if (this.open) {
      this.socket.write(encodeText(text));
    }
  }

  ping() {
    if (this.open) {
      this.socket.write(encodeFrame(OPCODE.PING, Buffer.alloc(0)));
    }
  }

  close(code = 1000, reason = '') {
    if (!this.open) {
      this.#closed();
      return;
    }
    this.open = false;
    try {
      this.socket.write(encodeClose(code, reason));
      this.socket.end();
    } catch {
      this.socket.destroy();
    }
    this.#closed();
  }

  #receive(chunk) {
    let messages;

    try {
      messages = this.decoder.push(chunk);
    } catch {
      this.close(1002, 'protocol error');
      return;
    }

    for (const message of messages) {
      if (message.opcode === OPCODE.TEXT) {
        this.#dispatch(message.payload.toString('utf8'));
      } else if (message.opcode === OPCODE.BINARY) {
        this.#dispatch(message.payload);
      } else if (message.opcode === OPCODE.PING) {
        this.socket.write(encodePong(message.payload));
      } else if (message.opcode === OPCODE.CLOSE) {
        const code = message.payload.length >= 2 ? message.payload.readUInt16BE(0) : 1000;
        this.close(code === 1005 ? 1000 : code, '');
      }
    }
  }

  #dispatch(payload) {
    if (this.onMessage) {
      this.onMessage(payload);
    } else {
      this.pendingMessages.push(payload);
    }
  }

  #closed() {
    if (this.closedNotified) {
      return;
    }
    this.open = false;
    this.closedNotified = true;
    this.onClose();
  }
}

/**
 * Attach a raw WebSocket endpoint to an existing HTTP server.
 * Only the upgrade path returned by `shouldAccept` is upgraded.
 */
export function attachWebSocketServer(httpServer, {
  path = '/ws',
  onConnection,
  shouldAccept = () => true,
} = {}) {
  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');

    if (url.pathname !== path || request.headers.upgrade?.toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const key = request.headers['sec-websocket-key'];
    const version = request.headers['sec-websocket-version'];
    if (!key || version !== '13' || !shouldAccept(request)) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${websocketAccept(key)}`,
        '',
        '',
      ].join('\r\n'),
    );

    const connection = new WebSocketConnection(socket, head);
    onConnection(connection, request);
  });
}
