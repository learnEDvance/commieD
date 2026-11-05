import { describe, expect, it } from 'vitest';
import { APP_NAME } from './index.js';

describe('shared', () => {
  it('exposes the product name', () => {
    expect(APP_NAME).toBe('commieD');
  });
});
