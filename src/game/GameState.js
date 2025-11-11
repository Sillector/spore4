import { ORBIT_RADIUS_MIN, ORBIT_RADIUS_MAX } from './constants.js';

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
      theta: Math.PI / 2,
      phi: 0,
      radius: 22,
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
    const baseRadius = 25;
    this.orbitMotion.radius = Math.min(
      Math.max(baseRadius, ORBIT_RADIUS_MIN),
      ORBIT_RADIUS_MAX
    );
    this.orbitZoomBuffer = 0;
  }
}
