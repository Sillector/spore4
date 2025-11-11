import galaxy from './galaxy.json';
import system from './system.json';
import ship from './ship.json';
import orbit from './orbit.json';
import background from './background.json';
import scene from './scene.json';

const clone = (value) => (
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
);

const sources = { galaxy, system, ship, orbit, background, scene };
const store = new Map();

for (const [name, data] of Object.entries(sources)) {
  store.set(name, clone(data));
}

function mergeDeep(target, source) {
  if (typeof source !== 'object' || source === null) {
    return source;
  }
  if (Array.isArray(source)) {
    return source.slice();
  }
  const result = target && typeof target === 'object' && !Array.isArray(target)
    ? target
    : {};
  const currentKeys = new Set(Object.keys(result));
  for (const key of Object.keys(source)) {
    const value = source[key];
    result[key] = mergeDeep(result[key], value);
    currentKeys.delete(key);
  }
  for (const key of currentKeys) {
    delete result[key];
  }
  return result;
}

export function getConfig(name) {
  const config = store.get(name);
  if (!config) {
    throw new Error(`Unknown config: ${name}`);
  }
  return config;
}

export function getConfigNames() {
  return Array.from(store.keys());
}

export function getConfigSnapshot(name) {
  return clone(getConfig(name));
}

export function getAllConfigSnapshots() {
  const result = {};
  for (const name of getConfigNames()) {
    result[name] = getConfigSnapshot(name);
  }
  return result;
}

export function updateConfig(name, data) {
  const current = getConfig(name);
  const merged = mergeDeep(current, data);
  store.set(name, merged);
  return merged;
}
