import {
  getConfigMetaSnapshot,
  getConfigNames,
  getConfigSnapshot,
  updateConfig
} from '../config/store.js';

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

function createFieldInput(value) {
  if (typeof value === 'boolean') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.dataset.configType = 'boolean';
    input.className = 'dev-panel__checkbox';
    return input;
  }

  const input = document.createElement('input');
  input.type = typeof value === 'number' ? 'number' : 'text';
  if (typeof value === 'number') {
    input.step = 'any';
  }
  input.value = value;
  input.dataset.configType = typeof value;
  input.className = 'dev-panel__input';
  return input;
}

function getMetaEntry(meta, path) {
  return meta[path.join('.')] || {};
}

function renderEntries(container, value, path, meta) {
  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value);

  for (const [key, childValue] of entries) {
    const nextPath = path.concat(String(key));
    const metaEntry = getMetaEntry(meta, nextPath);
    const description = metaEntry.description || '';

    if (childValue !== null && typeof childValue === 'object') {
      const group = document.createElement('div');
      group.className = 'dev-panel__group';

      const groupLabel = document.createElement('div');
      groupLabel.className = 'dev-panel__group-label';
      groupLabel.textContent = key;
      if (description) {
        groupLabel.title = description;
      }
      group.appendChild(groupLabel);

      const groupContent = document.createElement('div');
      groupContent.className = 'dev-panel__group-content';
      renderEntries(groupContent, childValue, nextPath, meta);
      group.appendChild(groupContent);

      container.appendChild(group);
    } else {
      const field = document.createElement('label');
      field.className = 'dev-panel__field';

      const label = document.createElement('span');
      label.className = 'dev-panel__field-label';
      label.textContent = key;
      if (description) {
        label.title = description;
      }
      field.appendChild(label);

      const input = createFieldInput(childValue);
      input.dataset.configPath = nextPath.join('.');
      if (metaEntry.type) {
        input.dataset.configType = metaEntry.type;
      }
      field.appendChild(input);

      container.appendChild(field);
    }
  }
}

function getInputValue(input) {
  const type = input.dataset.configType;
  if (type === 'boolean') {
    return input.checked;
  }
  if (type === 'number') {
    const parsed = Number(input.value);
    if (Number.isNaN(parsed)) {
      throw new Error('Некорректное число');
    }
    return parsed;
  }
  return input.value;
}

function assignValue(target, path, value) {
  let current = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const actualKey = Array.isArray(current) ? Number(key) : key;
    current = current[actualKey];
  }

  const lastKey = path[path.length - 1];
  const actualLastKey = Array.isArray(current) ? Number(lastKey) : lastKey;
  current[actualLastKey] = value;
}

function createSection(name) {
  let data = getConfigSnapshot(name);
  const meta = getConfigMetaSnapshot(name);

  const section = document.createElement('section');
  section.className = 'dev-panel__section';

  const header = document.createElement('div');
  header.className = 'dev-panel__section-header';

  const heading = document.createElement('div');
  heading.className = 'dev-panel__section-heading';

  const collapseButton = document.createElement('button');
  collapseButton.type = 'button';
  collapseButton.className = 'dev-panel__collapse';
  collapseButton.setAttribute('aria-label', `Переключить ${name}`);
  collapseButton.textContent = '▾';
  heading.appendChild(collapseButton);

  const title = document.createElement('h3');
  title.textContent = name;
  heading.appendChild(title);

  header.appendChild(heading);

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Сохранить';
  saveButton.className = 'dev-panel__save';
  header.appendChild(saveButton);

  section.appendChild(header);

  const body = document.createElement('div');
  body.className = 'dev-panel__section-body';
  renderEntries(body, data, [], meta);
  section.appendChild(body);

  const status = createStatusElement();
  section.appendChild(status);

  let collapsed = true;

  function setCollapsed(next) {
    collapsed = next;
    section.classList.toggle('dev-panel__section--collapsed', collapsed);
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
  }

  setCollapsed(true);

  function toggleSection() {
    setCollapsed(!collapsed);
  }

  collapseButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSection();
  });

  header.addEventListener('click', (event) => {
    if (event.target.closest('.dev-panel__save')) {
      return;
    }
    if (event.target.closest('.dev-panel__collapse')) {
      return;
    }
    toggleSection();
  });

  saveButton.addEventListener('click', async () => {
    const inputs = Array.from(body.querySelectorAll('[data-config-path]'));
    const snapshot = JSON.parse(JSON.stringify(data));

    try {
      for (const input of inputs) {
        const value = getInputValue(input);
        const path = input.dataset.configPath.split('.');
        assignValue(snapshot, path, value);
      }

      status.textContent = 'Сохраняем...';
      status.dataset.state = '';

      await persistConfig(name, snapshot);
      updateConfig(name, snapshot);
      data = getConfigSnapshot(name);

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

  const content = document.createElement('div');
  content.className = 'dev-panel__content';
  panel.appendChild(content);

  const configs = getConfigNames();
  configs.forEach((name) => {
    content.appendChild(createSection(name));
  });

  toggleButton.addEventListener('click', () => {
    panel.classList.toggle('dev-panel--open');
  });

  const stopWheelPropagation = (event) => {
    event.stopPropagation();
  };

  panel.addEventListener('wheel', stopWheelPropagation, { passive: false });
  panel.addEventListener('wheel', stopWheelPropagation);
  panel.addEventListener('touchmove', stopWheelPropagation, { passive: false });

  document.body.appendChild(toggleButton);
  document.body.appendChild(panel);
}
