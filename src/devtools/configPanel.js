import { getConfigNames, getConfigSnapshot, updateConfig } from '../config/store.js';

function createStatusElement() {
  const status = document.createElement('div');
  status.className = 'dev-panel__status';
  return status;
}

async function persistConfig(name, data) {
  const response = await fetch(`/__config/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
}

function createSection(name) {
  const section = document.createElement('section');
  section.className = 'dev-panel__section';

  const header = document.createElement('div');
  header.className = 'dev-panel__section-header';

  const title = document.createElement('h3');
  title.textContent = name;
  header.appendChild(title);

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Сохранить';
  saveButton.className = 'dev-panel__save';
  header.appendChild(saveButton);

  section.appendChild(header);

  const textarea = document.createElement('textarea');
  textarea.className = 'dev-panel__editor';
  textarea.value = JSON.stringify(getConfigSnapshot(name), null, 2);
  textarea.spellcheck = false;
  section.appendChild(textarea);

  const status = createStatusElement();
  section.appendChild(status);

  saveButton.addEventListener('click', async () => {
    try {
      const parsed = JSON.parse(textarea.value);
      status.textContent = 'Сохраняем...';
      status.dataset.state = '';
      await persistConfig(name, parsed);
      updateConfig(name, parsed);
      status.textContent = 'Сохранено';
      status.dataset.state = 'success';
      setTimeout(() => {
        status.textContent = '';
        status.dataset.state = '';
      }, 2000);
    } catch (error) {
      status.textContent = `Ошибка: ${error.message}`;
      status.dataset.state = 'error';
    }
  });

  return section;
}

export function setupConfigPanel() {
  if (!import.meta.env.DEV) {
    return;
  }

  const toggleButton = document.createElement('button');
  toggleButton.className = 'dev-panel__toggle';
  toggleButton.type = 'button';
  toggleButton.textContent = '⚙ Конфиги';

  const panel = document.createElement('aside');
  panel.className = 'dev-panel';

  const title = document.createElement('h2');
  title.className = 'dev-panel__title';
  title.textContent = 'Настройки механик';
  panel.appendChild(title);

  const configs = getConfigNames();
  configs.forEach((name) => {
    panel.appendChild(createSection(name));
  });

  toggleButton.addEventListener('click', () => {
    panel.classList.toggle('dev-panel--open');
  });

  document.body.appendChild(toggleButton);
  document.body.appendChild(panel);
}
