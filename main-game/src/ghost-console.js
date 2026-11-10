const MINIGAMES = Object.freeze({
  clicker: {
    label: 'SOUL',
    title: 'SOUL CLICKER',
    src: '../soul-clicker/index.html',
    hint: 'Click to raise team HP. Keep CPS at 5 or higher.',
  },
  ammo: {
    label: 'AMMO',
    title: 'BULLET PRESS',
    src: '../bullet-press/index.html',
    hint: 'Type the sequence to press magazines into team ammo.',
  },
  dash: {
    label: 'DASH',
    title: 'DASH SUPPLEMENT FACTORY',
    src: '../dash-supplement-factory/index.html',
    hint: 'Work the shared factory with every ghost on your team.',
  },
});

const TASKS = Object.keys(MINIGAMES);

/**
 * Ghost-shift console. It owns one iframe at a time and relays minigame
 * contributions to the host. The iframe never talks to the server directly.
 */
export class GhostConsole {
  constructor({
    root,
    onContribute = () => {},
    onFactoryAction = () => {},
    onPointer = () => {},
    onTask = () => {},
    onClose = () => {},
  } = {}) {
    this.root = root;
    this.onContribute = onContribute;
    this.onFactoryAction = onFactoryAction;
    this.onPointer = onPointer;
    this.onTask = onTask;
    this.onClose = onClose;
    this.task = 'clicker';
    this.loadedTask = null;
    this.frameLoaded = false;
    this.visible = false;
    this.identity = { clientId: null, teamId: null, playerId: null };
    this.state = null;
    this.pointerNext = 0;

    this.frame = root.querySelector('#ghost-frame');
    this.title = root.querySelector('#ghost-title');
    this.hint = root.querySelector('#ghost-hint');
    this.status = root.querySelector('#ghost-status');
    this.tabs = [...root.querySelectorAll('[data-ghost-task]')];
    this.closeButton = root.querySelector('#ghost-close');

    for (const tab of this.tabs) {
      tab.addEventListener('click', () => {
        const task = tab.dataset.ghostTask;
        if (TASKS.includes(task)) {
          this.select(task);
        }
      });
    }

    this.closeButton?.addEventListener('click', () => {
      this.hide();
      this.onClose();
    });

    this.frame?.addEventListener('load', () => {
      this.frameLoaded = true;
      this.#sendState();
      this.frame.contentWindow?.focus();
    });

    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (event.source !== this.frame?.contentWindow) {
        return;
      }
      this.#handleMessage(event.data);
    });

    this.#renderChrome();
  }

  setIdentity(identity) {
    this.identity = { ...this.identity, ...identity };
    this.#sendState();
  }

  setState(state) {
    this.state = { ...this.state, ...state };

    if (!this.state.visible) {
      this.hide();
      return;
    }

    if (this.state.task && TASKS.includes(this.state.task) && this.state.task !== this.task) {
      this.select(this.state.task, { notify: false });
    }

    this.show();
    this.#renderChrome();
    this.#sendState();
  }

  show() {
    this.visible = true;
    this.root.hidden = false;
    this.root.classList.add('is-open');
    this.#ensureFrame();
    this.#renderChrome();
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('is-open');
    this.root.hidden = true;
  }

  select(task, { notify = true } = {}) {
    this.task = task;
    this.show();
    this.#renderChrome();
    this.#sendState();

    if (notify) {
      this.onTask(task);
    }
  }

  /* ------------------------------ internals ------------------------------ */

  #ensureFrame() {
    if (this.loadedTask === this.task) {
      return;
    }

    const meta = MINIGAMES[this.task];
    this.loadedTask = this.task;
    this.frameLoaded = false;
    this.frame.src = `${meta.src}?embed=1`;
  }

  #renderChrome() {
    const meta = MINIGAMES[this.task];
    this.root.dataset.task = this.task;
    this.title.textContent = meta.title;
    this.hint.textContent = meta.hint;

    for (const tab of this.tabs) {
      tab.classList.toggle('is-active', tab.dataset.ghostTask === this.task);
      tab.setAttribute('aria-pressed', String(tab.dataset.ghostTask === this.task));
    }

    if (this.state?.eliminated) {
      this.status.textContent = 'TEAM ELIMINATED — PRODUCTION HALTED';
    } else if (this.task === 'dash' && this.state?.factory) {
      const factory = this.state.factory;
      this.status.textContent = `${Math.floor(Number(this.state?.dashSeconds) || 0)}s DASH AVAILABLE · ${factory.batchesWasted} WASTED`;
    } else if (this.task === 'clicker') {
      this.status.textContent = `TEAM HP ${Number(this.state?.hp ?? 0).toFixed(1)} · ${this.state?.livingTeammates ?? 0} LIVING`;
    } else {
      this.status.textContent = `TEAM AMMO ${Math.floor(this.state?.ammo ?? 0)} · SHARED BY ALL COMRADES`;
    }
  }

  #sendState() {
    if (!this.frameLoaded || !this.frame?.contentWindow) {
      return;
    }

    this.frame.contentWindow.postMessage(
      {
        type: 'state',
        game: this.task,
        clientId: this.identity.clientId,
        teamId: this.identity.teamId,
        playerId: this.identity.playerId,
        hp: this.state?.hp ?? 0,
        maxHp: this.state?.maxHp ?? 0,
        baseline: this.state?.baseline ?? 0,
        livingTeammates: this.state?.livingTeammates ?? 0,
        ammo: this.state?.ammo ?? 0,
        dashSeconds: this.state?.dashSeconds ?? 0,
        factory: this.task === 'dash' ? this.state?.factory ?? null : null,
        eliminated: Boolean(this.state?.eliminated),
      },
      window.location.origin,
    );
  }

  #handleMessage(data) {
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'minigame-ready') {
      this.#sendState();
      this.frame.contentWindow?.focus();
      return;
    }

    if (data.type === 'contribute') {
      this.onContribute({
        game: data.game,
        resources: data.resources ?? {},
      });
      return;
    }

    if (data.type === 'factory-action') {
      this.onFactoryAction({
        action: data.action,
        batchId: data.batchId,
        targetId: data.targetId,
      });
      return;
    }

    if (data.type === 'pointer') {
      const now = performance.now();
      if (data.active !== false && now < this.pointerNext) {
        return;
      }
      this.pointerNext = now + 60;
      this.onPointer({ x: data.x, y: data.y, active: data.active });
    }
  }
}

export { MINIGAMES, TASKS };
