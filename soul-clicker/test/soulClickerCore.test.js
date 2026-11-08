import assert from 'node:assert/strict';
import test from 'node:test';
import { SoulClicker } from '../src/soulClickerCore.js';

test('starts at the baseline for the living team size', () => {
  const clicker = new SoulClicker({ livingTeammates: 4 });

  assert.equal(clicker.baseline, 400);
  assert.equal(clicker.hp, 400);
  assert.equal(clicker.band, 'yellow');
});

test('uses the requested HP bands', () => {
  const clicker = new SoulClicker({ livingTeammates: 4 });

  clicker.hp = 399.99;
  assert.equal(clicker.band, 'red');
  clicker.hp = 490;
  assert.equal(clicker.band, 'yellow');
  clicker.hp = 490.01;
  assert.equal(clicker.band, 'green');
});

test('loses 0.2 HP/s while idle', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.tick(1_000, 1);

  assert.ok(Math.abs(clicker.hp - 99.8) < 1e-9);
});

test('gains 1 HP/s at 5 CPS', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  for (let i = 0; i < 50; i += 1) {
    clicker.click(i * 200);
  }

  assert.ok(Math.abs(clicker.cpsAt(9_800) - 5) < 1e-9);
  clicker.tick(9_800, 1);
  assert.ok(Math.abs(clicker.hp - 101) < 1e-9);
});

test('loses 0.2 HP/s below 5 CPS', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  for (let i = 0; i < 49; i += 1) {
    clicker.click(i * 200);
  }

  clicker.tick(9_600, 1);
  assert.ok(Math.abs(clicker.hp - 99.8) < 1e-9);
});

test('does not cap team HP', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });
  clicker.hp = 10_000;

  for (let i = 0; i < 50; i += 1) {
    clicker.click(i * 200);
  }
  clicker.tick(9_800, 1);

  assert.ok(clicker.hp > 10_000);
});

test('adds the shape bonus', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.addShapeBonus();

  assert.equal(clicker.hp, 105);
});

test('updates the baseline when living teammates change', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.setLivingTeammates(3);

  assert.equal(clicker.baseline, 300);
});

test('expires clicks outside the CPS window', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.click(0);

  assert.equal(clicker.cpsAt(10_001), 0);
});

test('ignores invalid tick deltas', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  const rate = clicker.tick(1_000, 0);

  assert.equal(rate, 0);
  assert.equal(clicker.hp, 100);
});
