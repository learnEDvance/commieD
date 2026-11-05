import { APP_NAME } from '@commied/shared';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app element');
}

root.textContent = `${APP_NAME} — foundation ready`;
