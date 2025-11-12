import { getConfig } from '../config/store.js';

const worldConfig = getConfig('world');
const baseSeed = String(worldConfig?.seed ?? 'default-seed');

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function createState() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return function random() {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b) | 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    d = (d + 1) | 0;
    const result = (t + d) >>> 0;
    return result / 4294967296;
  };
}

function normalizeSeedParts(parts) {
  return parts
    .filter((part) => part !== undefined && part !== null)
    .map((part) => String(part))
    .join('::');
}

function createSource(seedParts) {
  const seed = `${baseSeed}::${normalizeSeedParts(seedParts)}`;
  const state = xmur3(seed);
  return sfc32(state(), state(), state(), state());
}

export function getWorldSeed() {
  return baseSeed;
}

export function createRandomGenerator(...seedParts) {
  const source = createSource(seedParts);
  return {
    next() {
      return source();
    },
    float(min = 0, max = 1) {
      return source() * (max - min) + min;
    },
    int(min, max) {
      if (max < min) {
        return min;
      }
      const range = max - min + 1;
      return Math.floor(source() * range) + min;
    },
    floatSpread(range) {
      return (source() - 0.5) * range;
    },
    pick(array) {
      if (!array.length) {
        return undefined;
      }
      const index = Math.floor(source() * array.length);
      return array[index];
    }
  };
}

export function createWorldRandom(...seedParts) {
  return createRandomGenerator(...seedParts);
}

export function createSeedKey(...parts) {
  return normalizeSeedParts(parts);
}
