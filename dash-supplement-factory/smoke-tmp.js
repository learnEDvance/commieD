const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitFor(fn, timeout = 12000, label = 'condition') {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    if (fn()) return true;
    await sleep(50);
  }
  check(`timeout: ${label}`, false, `${Math.round(performance.now() - started)}ms`);
  return false;
}

async function dragPot(potId, stationId) {
  const pot = document.querySelector(`.pot[data-pot-id="${potId}"]`);
  const card = document.querySelector(`.station[data-station-id="${stationId}"]`);
  if (!pot || !card) return false;
  const p = pot.getBoundingClientRect();
  const t = card.getBoundingClientRect();
  const at = (x, y) => ({
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    clientX: x,
    clientY: y,
  });
  pot.dispatchEvent(new PointerEvent('pointerdown', at(p.left + p.width / 2, p.top + p.height / 2)));
  window.dispatchEvent(new PointerEvent('pointermove', at(t.left + t.width / 2, t.top + t.height / 2)));
  window.dispatchEvent(new PointerEvent('pointerup', at(t.left + t.width / 2, t.top + t.height / 2)));
  await sleep(100);
  return true;
}

function potReadyAt(stationId) {
  const pot = document.querySelector(`.station[data-station-id="${stationId}"] .pot`);
  return Boolean(pot) && pot.classList.contains('is-ready');
}

async function run() {
  await sleep(400);

  check('vial belt exists', Boolean(document.querySelector('.outfeed--vials .belt__track')));
  check('empties belt exists', Boolean(document.querySelector('.outfeed--empties .belt__track')));
  check(
    'belts are beside the bottler',
    (() => {
      const card = document.querySelector('.station[data-station-id="bottler"]').getBoundingClientRect();
      const vial = document.querySelector('.outfeed--vials .belt').getBoundingClientRect();
      const empty = document.querySelector('.outfeed--empties .belt').getBoundingClientRect();
      return (
        vial.left >= card.right - 1 &&
        empty.left >= card.right - 1 &&
        Math.min(innerWidth, vial.right) - vial.left > 140 &&
        Math.min(innerWidth, empty.right) - empty.left > 140
      );
    })(),
  );

  document.getElementById('take-pot').click();

  const route = ['mill', 'vat', 'press', 'still', 'vat', 'filter', 'bureau', 'still', 'vat', 'bureau', 'filter', 'press'];

  for (const station of route) {
    const ok = await dragPot(1, station);
    if (!ok) {
      check(`drag to ${station}`, false);
      return;
    }
    if (!(await waitFor(() => potReadyAt(station), 12000, `ready at ${station}`))) return;
  }

  check('pot reached the bottler', Boolean(document.querySelector('.station[data-station-id="bottler"] .pot')));

  await dragPot(1, 'bottler');
  if (!(await waitFor(() => Boolean(document.querySelector('.station[data-station-id="bottler"] .pot.is-bottling')), 4000, 'bottling starts'))) return;

  await waitFor(() => {
    const pot = document.querySelector('.station[data-station-id="bottler"] .pot.is-bottling');
    return pot && parseFloat(pot.style.getPropertyValue('--fill')) < 90;
  }, 5000, 'pot drains');

  check(
    'active pot drains',
    (() => {
      const pot = document.querySelector('.station[data-station-id="bottler"] .pot.is-bottling');
      return Boolean(pot) && parseFloat(pot.style.getPropertyValue('--fill')) < 95;
    })(),
  );
  check(
    'vials ride the belt in sequence',
    document.querySelectorAll('.outfeed--vials .belt-vial').length >= 2,
  );
  check(
    'vials stay opaque',
    [...document.querySelectorAll('.belt-vial')].every((vial) => getComputedStyle(vial).opacity === '1'),
  );
  check('no fading pot during bottling', document.querySelectorAll('.fx-pot').length === 0);

  await waitFor(() => document.getElementById('vials-stat').textContent === '20', 12000, 'vials banked');

  check('twenty vials banked', document.getElementById('vials-stat').textContent === '20');
  check(
    'empty pot rides the lower belt',
    document.querySelectorAll('.outfeed--empties .belt-pot').length === 1,
  );
  check(
    'empty pot does not fade',
    (() => {
      const pot = document.querySelector('.outfeed--empties .belt-pot');
      return Boolean(pot) && getComputedStyle(pot).opacity === '1';
    })(),
  );
  check(
    'bottler slot clears',
    document.querySelectorAll('.station[data-station-id="bottler"] .slot .pot').length === 0,
  );

  await waitFor(() => document.querySelectorAll('.belt-pot').length === 0, 9000, 'empty pot leaves the belt');
  check('empty pot leaves on the belt', document.querySelectorAll('.belt-pot').length === 0);

  const pre = document.createElement('pre');
  pre.id = 'smoke-results';
  pre.textContent = results.join('\n');
  document.body.append(pre);
  document.title = `SMOKE ${results.filter((r) => r.startsWith('PASS')).length}/${results.length}`;
}

run().catch((error) => {
  const pre = document.createElement('pre');
  pre.id = 'smoke-results';
  pre.textContent = `SMOKE ERROR ${error?.stack ?? error}`;
  document.body.append(pre);
});
