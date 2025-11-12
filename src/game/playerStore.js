const STORAGE_KEY = 'spaceGame:player';
const READ_INTERVAL = 1000;

const defaultPlayerState = {
  currentStarId: null,
  currentPlanetId: null,
  state: 'galaxy'
};

function normalizeState(state) {
  if (state === 'planet' || state === 'system' || state === 'galaxy') {
    return state;
  }
  return defaultPlayerState.state;
}

function levelToPlayerState(level, hasPlanet) {
  if (level === 'orbit' || (level === 'transition' && hasPlanet)) {
    return 'planet';
  }
  if (level === 'system' || level === 'transition') {
    return 'system';
  }
  return 'galaxy';
}

function readStorage() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      currentStarId: parsed.currentStarId ?? null,
      currentPlanetId: parsed.currentPlanetId ?? null,
      state: normalizeState(parsed.state)
    };
  } catch (error) {
    console.warn('Failed to read player from storage', error);
    return null;
  }
}

function writeStorage(data) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to write player to storage', error);
  }
}

export class PlayerStore {
  constructor() {
    this.player = { ...defaultPlayerState };
    this.lastSyncedState = { ...defaultPlayerState };
    const stored = readStorage();
    if (stored) {
      Object.assign(this.player, stored);
      Object.assign(this.lastSyncedState, stored);
    }
    globalThis.player = this.player;
    writeStorage(this.player);
    this.syncTimer = typeof window !== 'undefined'
      ? window.setInterval(() => this.readFromStorage(), READ_INTERVAL)
      : null;
  }

  readFromStorage() {
    const stored = readStorage();
    if (!stored) {
      return;
    }
    let changed = false;
    if (stored.currentStarId !== this.player.currentStarId) {
      this.player.currentStarId = stored.currentStarId;
      changed = true;
    }
    if (stored.currentPlanetId !== this.player.currentPlanetId) {
      this.player.currentPlanetId = stored.currentPlanetId;
      changed = true;
    }
    if (stored.state && stored.state !== this.player.state) {
      this.player.state = stored.state;
      changed = true;
    }
    if (changed) {
      Object.assign(this.lastSyncedState, this.player);
    }
  }

  syncFromState(state) {
    const starId = state?.currentStar?.id ?? null;
    const planetId = state?.currentPlanet?.id ?? null;
    const level = state?.level ?? defaultPlayerState.state;
    const stableState = levelToPlayerState(level, Boolean(state?.currentPlanet));
    const nextState = {
      currentStarId: starId,
      currentPlanetId: planetId,
      state: stableState
    };
    const hasChanges =
      nextState.currentStarId !== this.lastSyncedState.currentStarId ||
      nextState.currentPlanetId !== this.lastSyncedState.currentPlanetId ||
      nextState.state !== this.lastSyncedState.state;
    if (!hasChanges) {
      return;
    }
    this.player.currentStarId = nextState.currentStarId;
    this.player.currentPlanetId = nextState.currentPlanetId;
    this.player.state = nextState.state;
    Object.assign(this.lastSyncedState, nextState);
    writeStorage(this.player);
  }

  getSnapshot() {
    return { ...this.player };
  }

  dispose() {
    if (this.syncTimer) {
      window.clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}
