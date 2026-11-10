import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FrameDecoder,
  OPCODE,
  encodeFrame,
  websocketAccept,
} from '../ws.js';

test('the RFC 6455 example handshake key is accepted', () => {
  assert.equal(
    websocketAccept('dGhlIHNhbXBsZSBub25jZQ=='),
    's3pPLMBiTxaQ9kYGzzhZRbK+xOo=',
  );
});

test('a masked client text frame decodes', () => {
  const decoder = new FrameDecoder();
  const messages = decoder.push(
    encodeFrame(OPCODE.TEXT, Buffer.from('hello'), { mask: true }),
  );

  assert.equal(messages.length, 1);
  assert.equal(messages[0].opcode, OPCODE.TEXT);
  assert.equal(messages[0].payload.toString('utf8'), 'hello');
});

test('fragmented messages are joined until the final frame', () => {
  const decoder = new FrameDecoder();
  const first = encodeFrame(OPCODE.TEXT, Buffer.from('hello '), {
    mask: true,
    fin: false,
  });
  const second = encodeFrame(OPCODE.CONTINUATION, Buffer.from('comrade'), {
    mask: true,
    fin: true,
  });

  assert.deepEqual(decoder.push(first), []);
  const messages = decoder.push(second);

  assert.equal(messages.length, 1);
  assert.equal(messages[0].payload.toString('utf8'), 'hello comrade');
});

test('frames split across socket chunks are buffered', () => {
  const decoder = new FrameDecoder();
  const frame = encodeFrame(OPCODE.TEXT, Buffer.from('split'), { mask: true });

  assert.deepEqual(decoder.push(frame.subarray(0, 3)), []);
  const messages = decoder.push(frame.subarray(3));

  assert.equal(messages[0].payload.toString('utf8'), 'split');
});

test('control frames decode immediately', () => {
  const decoder = new FrameDecoder();
  const messages = decoder.push(
    encodeFrame(OPCODE.PING, Buffer.from('beat'), { mask: true }),
  );

  assert.equal(messages[0].opcode, OPCODE.PING);
  assert.equal(messages[0].payload.toString('utf8'), 'beat');
});

test('unmasked client frames are rejected', () => {
  const decoder = new FrameDecoder();
  assert.throws(
    () => decoder.push(encodeFrame(OPCODE.TEXT, Buffer.from('nope'))),
    /masked/,
  );
});

test('oversized messages are rejected', () => {
  const decoder = new FrameDecoder({ maxMessageBytes: 4 });
  assert.throws(
    () => decoder.push(encodeFrame(OPCODE.TEXT, Buffer.from('too long'), { mask: true })),
    /too large/,
  );
});
