import assert from 'node:assert/strict';
import test from 'node:test';
import { SoulClicker } from '../src/soulClickerCore.js';

function close(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `expected ${actual} to be close to ${expected}`,
  );
}

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

  close(clicker.hp, 99.8);
});

test('advanceTo applies elapsed time exactly once', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.advanceTo(1_000);
  close(clicker.hp, 100);

  clicker.advanceTo(2_000);
  close(clicker.hp, 99.8);

  clicker.advanceTo(2_000);
  close(clicker.hp, 99.8);

  clicker.advanceTo(3_000);
  close(clicker.hp, 99.6);
});

test('settles HP immediately when a click lands', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.advanceTo(1_000);
  clicker.click(1_100);

  close(clicker.hp, 99.98);
});

test('registerClick counts CPS without changing HP', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });
  clicker.hp = 150;

  clicker.registerClick(1_000);
  clicker.registerClick(1_200);

  close(clicker.hp, 150);
  close(clicker.cpsAt(1_200), 0.2);
});

test('gains 1 HP/s at 5 CPS', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.advanceTo(0);
  for (let i = 0; i < 50; i += 1) {
    clicker.click(i * 200);
  }

  assert.ok(Math.abs(clicker.cpsAt(9_800) - 5) < 1e-9);

  clicker.hp = 100;
  const rate = clicker.tick(9_800, 1);

  assert.equal(rate, 1);
  close(clicker.hp, 101);
});

test('loses 0.2 HP/s below 5 CPS', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.advanceTo(0);
  for (let i = 0; i < 49; i += 1) {
    clicker.click(i * 200);
  }

  clicker.hp = 100;
  const rate = clicker.tick(9_600, 1);

  assert.equal(rate, -0.2);
  close(clicker.hp, 99.8);
});

test('switches to gain as soon as CPS reaches 5', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.advanceTo(0);
  for (let i = 0; i < 50; i += 1) {
    clicker.click(i * 200);
  }

  close(clicker.cpsAt(9_800), 5);
  assert.equal(clicker.hpPerSecondAt(9_800), 1);

  const before = clicker.hp;
  clicker.advanceTo(9_900);

  assert.ok(clicker.hp > before, 'HP should rise on the next settlement');
});

test('adds HP immediately on a click once CPS is 5', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.advanceTo(0);
  for (let i = 0; i < 50; i += 1) {
    clicker.click(i * 200);
  }

  const before = clicker.hp;
  clicker.click(9_900);

  close(clicker.hp, before + 0.1);
});

test('settles the pre-click rate before the new click counts', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.advanceTo(0);
  for (let i = 0; i < 49; i += 1) {
    clicker.click(i * 200);
  }

  const before = clicker.hp;
  clicker.click(9_700);

  assert.ok(clicker.hp < before, 'HP should still fall before 5 CPS is reached');
});

test('does not cap team HP', () => {
  const clicker = new SoulClicker({ livingTeammates: 1 });

  clicker.advanceTo(0);
  for (let i = 0; i < 50; i += 1) {
    clicker.click(i * 200);
  }

  clicker.hp = 10_000;
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
