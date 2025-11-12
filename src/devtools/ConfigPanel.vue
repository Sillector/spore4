<template>
  <div>
    <button class="dev-panel__toggle" type="button" @click="togglePanel">
      ⚙ Конфиги
    </button>
    <aside
      class="dev-panel"
      :class="{ 'dev-panel--open': isOpen }"
      @wheel.stop
      @touchmove.stop
    >
      <h2 class="dev-panel__title">Настройки механик</h2>
      <div class="dev-panel__content">
        <section
          v-for="section in sections"
          :key="section.name"
          class="dev-panel__section"
          :class="{ 'dev-panel__section--collapsed': section.collapsed }"
        >
          <div class="dev-panel__section-header" @click="toggleSection(section)">
            <div class="dev-panel__section-heading">
              <button
                class="dev-panel__collapse"
                type="button"
                :aria-expanded="(!section.collapsed).toString()"
                @click.stop="toggleSection(section)"
              >
                ▾
              </button>
              <h3>{{ section.name }}</h3>
            </div>
            <button class="dev-panel__save" type="button" @click.stop="saveSection(section)">
              Сохранить
            </button>
          </div>
          <div class="dev-panel__section-body">
            <ConfigEntries
              :value="section.draft"
              :original="section.original"
              :meta="section.meta"
              @update="(update) => applyUpdate(section, update)"
            />
          </div>
          <div class="dev-panel__status" :data-state="section.statusState">
            {{ section.status }}
          </div>
        </section>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import ConfigEntries from './ConfigEntries.vue';
import {
  getConfigMetaSnapshot,
  getConfigNames,
  getConfigSnapshot,
  updateConfig
} from '../config/store.js';

const isOpen = ref(false);

const sections = ref(getConfigNames().map(createSection));

function createSection(name) {
  const original = getConfigSnapshot(name);
  return reactive({
    name,
    original,
    draft: reactive(createDraft(original)),
    meta: getConfigMetaSnapshot(name),
    collapsed: true,
    status: '',
    statusState: ''
  });
}

function createDraft(value) {
  if (Array.isArray(value)) {
    return value.map((item) => createDraft(item));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = createDraft(child);
    }
    return result;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return value;
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

function replaceInPlace(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    target.splice(0, target.length, ...source);
    return;
  }
  if (target && typeof target === 'object' && source && typeof source === 'object') {
    for (const key of Object.keys(target)) {
      if (!(key in source)) {
        delete target[key];
      }
    }
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        if (!Array.isArray(target[key])) {
          target[key] = [];
        }
        replaceInPlace(target[key], value);
      } else if (value && typeof value === 'object') {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          target[key] = {};
        }
        replaceInPlace(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }
}

function buildPayload(draft, reference, meta, path = []) {
  if (Array.isArray(draft)) {
    return draft.map((item, index) =>
      buildPayload(item, reference?.[index], meta, path.concat(String(index)))
    );
  }
  if (draft && typeof draft === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(draft)) {
      result[key] = buildPayload(value, reference?.[key], meta, path.concat(key));
    }
    return result;
  }
  const metaEntry = meta[path.join('.')] || {};
  const targetType = metaEntry.type || typeof reference;
  if (targetType === 'boolean') {
    return Boolean(draft);
  }
  if (targetType === 'number') {
    const parsed = typeof draft === 'number' ? draft : Number(draft);
    if (Number.isNaN(parsed)) {
      throw new Error(`Некорректное число в поле "${path.join('.')}"`);
    }
    return parsed;
  }
  return draft;
}

function applyUpdate(section, update) {
  const nextValue = update.fieldType === 'boolean' ? Boolean(update.value) : update.value;
  assignValue(section.draft, update.path, nextValue);
}

async function saveSection(section) {
  try {
    const payload = buildPayload(section.draft, section.original, section.meta);
    section.status = 'Сохраняем...';
    section.statusState = '';
    await persistConfig(section.name, payload);
    const updated = updateConfig(section.name, payload);
    section.original = updated;
    replaceInPlace(section.draft, createDraft(updated));
    section.status = 'Сохранено';
    section.statusState = 'success';
    setTimeout(() => {
      section.status = '';
      section.statusState = '';
    }, 2000);
  } catch (error) {
    section.status = `Ошибка: ${error.message}`;
    section.statusState = 'error';
  }
}

function togglePanel() {
  isOpen.value = !isOpen.value;
}

function toggleSection(section) {
  section.collapsed = !section.collapsed;
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
</script>
