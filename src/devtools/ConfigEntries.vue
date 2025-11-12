<template>
  <div>
    <template v-for="entry in entries" :key="entry.key">
      <div v-if="entry.isGroup" class="dev-panel__group">
        <div class="dev-panel__group-label" :title="entry.description">{{ entry.label }}</div>
        <div class="dev-panel__group-content">
          <ConfigEntries
            :value="entry.value"
            :original="entry.original"
            :path="entry.path"
            :meta="meta"
            @update="emitUpdate"
          />
        </div>
      </div>
      <label v-else class="dev-panel__field">
        <span class="dev-panel__field-label" :title="entry.description">{{ entry.label }}</span>
        <template v-if="entry.fieldType === 'boolean'">
          <input
            class="dev-panel__checkbox"
            type="checkbox"
            :checked="entry.value"
            @change="onCheckboxChange(entry.path, $event.target.checked)"
          />
        </template>
        <template v-else>
          <input
            class="dev-panel__input"
            :type="entry.fieldType === 'number' ? 'number' : 'text'"
            :step="entry.fieldType === 'number' ? 'any' : undefined"
            :value="entry.value"
            @input="onInput(entry.path, $event.target.value, entry.fieldType)"
          />
        </template>
      </label>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';

defineOptions({
  name: 'ConfigEntries'
});

const props = defineProps({
  value: {
    type: [Object, Array],
    required: true
  },
  original: {
    type: [Object, Array],
    required: true
  },
  path: {
    type: Array,
    default: () => []
  },
  meta: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

const entries = computed(() => {
  const source = props.value;
  const original = props.original;
  const pairs = Array.isArray(source)
    ? source.map((item, index) => ({ key: String(index), value: item, original: original?.[index] }))
    : Object.keys(source).map((key) => ({ key, value: source[key], original: original?.[key] }));

  return pairs.map(({ key, value, original: originalValue }) => {
    const nextPath = props.path.concat(key);
    const metaKey = nextPath.join('.');
    const metaEntry = props.meta[metaKey] || {};
    const description = metaEntry.description || '';
    const baseType = metaEntry.type || typeof originalValue;

    if (value !== null && typeof value === 'object') {
      return {
        key: nextPath.join('|'),
        isGroup: true,
        label: key,
        path: nextPath,
        description,
        value,
        original: originalValue
      };
    }

    let fieldType = baseType;
    if (fieldType !== 'boolean' && fieldType !== 'number') {
      fieldType = 'text';
    }

    return {
      key: nextPath.join('|'),
      isGroup: false,
      label: key,
      path: nextPath,
      description,
      value: fieldType === 'boolean' ? Boolean(value) : value ?? '',
      fieldType
    };
  });
});

function emitUpdate(payload) {
  emit('update', payload);
}

function onInput(path, value, fieldType) {
  emit('update', { path, value, fieldType });
}

function onCheckboxChange(path, value) {
  emit('update', { path, value, fieldType: 'boolean' });
}
</script>
