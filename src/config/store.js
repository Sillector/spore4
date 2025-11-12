import galaxySource from './galaxy.xml?raw';
import systemSource from './system.xml?raw';
import shipSource from './ship.xml?raw';
import orbitSource from './orbit.xml?raw';
import backgroundSource from './background.xml?raw';
import sceneSource from './scene.xml?raw';
import worldSource from './world.xml?raw';
import starsSource from './stars.xml?raw';
import { cloneMeta, parseConfigXml } from './xml.js';

const clone = (value) => (
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
);

const sources = {
  galaxy: parseConfigXml(galaxySource),
  system: parseConfigXml(systemSource),
  ship: parseConfigXml(shipSource),
  orbit: parseConfigXml(orbitSource),
  background: parseConfigXml(backgroundSource),
  scene: parseConfigXml(sceneSource),
  world: parseConfigXml(worldSource),
  stars: parseConfigXml(starsSource)
};

const store = new Map();
const metaStore = new Map();
const titleStore = new Map();

for (const [name, { data, meta, title }] of Object.entries(sources)) {
  store.set(name, clone(data));
  metaStore.set(name, cloneMeta(meta));
  titleStore.set(name, title || name);
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

export function getConfigMeta(name) {
  const meta = metaStore.get(name);
  if (!meta) {
    throw new Error(`Unknown config meta: ${name}`);
  }
  return meta;
}

export function getConfigTitle(name) {
  return titleStore.get(name) || name;
}

export function getConfigNames() {
  return Array.from(store.keys());
}

export function getConfigSnapshot(name) {
  return clone(getConfig(name));
}

export function getConfigMetaSnapshot(name) {
  return cloneMeta(getConfigMeta(name));
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
