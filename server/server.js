import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Room } from './room.js';
import { attachWebSocketServer } from './ws.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
});

function safePath(urlPath) {
  let decoded;

  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  if (decoded.includes('\0')) {
    return null;
  }

  const normalized = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const filePath = path.resolve(REPO_ROOT, `.${normalized}`);

  if (filePath !== REPO_ROOT && !filePath.startsWith(`${REPO_ROOT}${path.sep}`)) {
    return null;
  }

  return filePath;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': MIME['.json'],
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

async function serveStatic(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  const url = new URL(request.url, 'http://localhost');

  if (url.pathname === '/') {
    response.writeHead(302, { Location: '/main-game/' });
    response.end();
    return;
  }

  if (url.pathname === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  const filePath = safePath(url.pathname);
  if (!filePath) {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  let info;

  try {
    info = await stat(filePath);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }

  if (info.isDirectory()) {
    response.writeHead(302, { Location: `${url.pathname.replace(/\/?$/, '/')}index.html` });
    response.end();
    return;
  }

  const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': type,
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath)
    .on('error', () => {
      if (!response.headersSent) {
        response.writeHead(500);
      }
      response.end();
    })
    .pipe(response);
}

/**
 * Build the HTTP + WebSocket server without listening. Useful in tests.
 */
export function createGameServer({ seed, room: providedRoom, tickMs = 33, snapshotMs = 50 } = {}) {
  const room = providedRoom ?? new Room(seed === undefined ? {} : { seed });
  const httpServer = createServer((request, response) => {
    serveStatic(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      response.end('Internal Server Error');
    });
  });

  const connections = new Map();

  attachWebSocketServer(httpServer, {
    path: '/ws',
    onConnection(connection) {
      const client = room.addClient({
        send(message) {
          connection.sendJson(message);
        },
      });
      connections.set(client.id, connection);

      connection.setMessageHandler((raw) => {
        let message;

        try {
          message = JSON.parse(String(raw));
        } catch {
          return;
        }

        if (!message || typeof message.type !== 'string') {
          return;
        }

        switch (message.type) {
          case 'join': {
            const result = room.join(client.id, {
              name: message.name,
              teamId: message.teamId,
            });
            if (!result.accepted) {
              client.send({ type: 'join-rejected', reason: result.reason });
            }
            break;
          }
          case 'input':
            room.handleInput(client.id, message);
            break;
          case 'contribute': {
            const result = room.handleContribution(client.id, message);
            if (!result.accepted) {
              client.send({ type: 'contribution-rejected', reason: result.reason });
            }
            break;
          }
          case 'factory': {
            const result = room.handleFactoryAction(client.id, message);
            if (result?.type === 'rejected') {
              client.send({ type: 'factory-reject', ...result });
            }
            break;
          }
          case 'pointer':
            room.handlePointer(client.id, message);
            break;
          case 'rematch':
            room.requestRematch(client.id);
            break;
          case 'ping':
            client.send({ type: 'pong', time: Date.now() });
            break;
          default:
            break;
        }
      });

      connection.onClose = () => {
        connections.delete(client.id);
        room.removeClient(client.id);
      };

      client.send({
        type: 'hello',
        clientId: client.id,
        teams: room.game.teams.map((team) => ({
          id: team.id,
          name: team.name,
          color: team.color,
        })),
        playersPerTeam: room.options.playersPerTeam,
        generation: room.generation,
      });
    },
  });

  let lastTick = performance.now();
  let lastSnapshot = lastTick;

  const tickTimer = setInterval(() => {
    const now = performance.now();
    const delta = Math.min(100, now - lastTick);
    lastTick = now;
    room.step(delta);

    if (now - lastSnapshot >= snapshotMs) {
      lastSnapshot = now;
      room.broadcastSnapshot();
    }
  }, tickMs);
  tickTimer.unref?.();

  const pingTimer = setInterval(() => {
    for (const connection of connections.values()) {
      connection.ping();
    }
  }, 25_000);
  pingTimer.unref?.();

  httpServer.on('close', () => {
    clearInterval(tickTimer);
    clearInterval(pingTimer);
  });

  return { httpServer, room };
}

export function startServer({ port = Number(process.env.PORT) || 8080, host = process.env.HOST || '0.0.0.0' } = {}) {
  const { httpServer, room } = createGameServer();

  httpServer.listen(port, host, () => {
    console.log(`commieD server listening on http://${host}:${port}`);
    console.log(`Open http://localhost:${port}/main-game/`);
    console.log(`Match seed ${room.game.seed}; ${room.options.teams} teams x ${room.options.playersPerTeam}.`);
  });

  const shutdown = () => {
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { httpServer, room };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startServer();
}
