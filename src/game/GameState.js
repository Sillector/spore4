import { getConfig } from '../config/store.js';

const orbitConfig = getConfig('orbit');

export class GameState {
  constructor() {
    this.level = 'galaxy';
    this.galaxyStars = [];
    this.currentStar = null;
    this.currentSystem = null;
    this.currentPlanet = null;
    this.pressedKeys = new Set();
    this.zoomProgress = {
      galaxy: 0,
      system: 0
    };
    this.zoomSmooth = {
      galaxy: 0,
      system: 0
    };
    this.orbitMotion = {
      theta: (orbitConfig.initialAngles.theta * Math.PI) / 180,
      phi: (orbitConfig.initialAngles.phi * Math.PI) / 180,
      radius: orbitConfig.radius.initial,
      velocityTheta: 0,
      velocityPhi: 0
    };
    this.orbitZoomBuffer = 0;
  }

  resetZoom(level) {
    if (!level || level === 'galaxy') {
      this.zoomProgress.galaxy = 0;
      this.zoomSmooth.galaxy = 0;
    }
    if (!level || level === 'system') {
      this.zoomProgress.system = 0;
      this.zoomSmooth.system = 0;
    }
  }

  resetOrbitMotion() {
    this.orbitMotion.theta = Math.PI / 2;
    this.orbitMotion.phi = 0;
    const baseRadius = orbitConfig.radius.base;
    this.orbitMotion.radius = Math.min(
      Math.max(baseRadius, orbitConfig.radius.min),
      orbitConfig.radius.max
    );
    this.orbitZoomBuffer = 0;
  }
}
