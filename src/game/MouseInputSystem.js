import { getConfig } from '../config/store.js';

const sceneConfig = getConfig('scene');

export class MouseInputSystem {
  constructor(game) {
    this.game = game;
    this.domElement = game.renderer.domElement;
    this.boundPointerMove = (event) => this.handlePointerMove(event);
    this.boundPointerDown = (event) => this.handlePointerDown(event);
    this.boundPointerLeave = () => this.handlePointerLeave();
    this.boundWheel = (event) => this.handleWheel(event);
    this.domElement.addEventListener('pointermove', this.boundPointerMove);
    this.domElement.addEventListener('pointerdown', this.boundPointerDown);
    this.domElement.addEventListener('pointerleave', this.boundPointerLeave);
    window.addEventListener('wheel', this.boundWheel, { passive: false });
  }

  handlePointerMove(event) {
    const { pointer, renderer, state, systemView } = this.game;
    const rect = renderer.domElement.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    pointer.x = (localX / rect.width) * 2 - 1;
    pointer.y = -(localY / rect.height) * 2 + 1;
    if (state.level === 'system') {
      this.game.updateSystemHover();
    } else {
      systemView.setHoveredPlanet(null);
    }
    this.game.updateHoverSelection();
  }

  handlePointerDown(event) {
    event.preventDefault();
    const intersects = this.game.pickIntersectables();
    if (!intersects.length) {
      return;
    }
    const first = intersects[0].object;
    if (this.game.state.level === 'galaxy') {
      this.game.galaxyView.moveShipToStar(this.game.ship, first.userData);
    } else if (this.game.state.level === 'system') {
      this.game.systemView.moveShipToPlanet(this.game.ship, first.userData);
    }
  }

  handlePointerLeave() {
    const { pointer, galaxyView, systemView } = this.game;
    systemView.setHoveredPlanet(null);
    pointer.set(0, 0);
    this.game.hoveredStar = null;
    galaxyView.setHoveredStar(null);
  }

  handleWheel(event) {
    event.preventDefault();
    const direction = -Math.sign(event.deltaY);
    if (direction === 0) {
      return;
    }
    const { state, galaxyView, systemView, orbitController } = this.game;
    if (state.level === 'galaxy') {
      const shouldEnterSystem = galaxyView.handleZoom(direction);
      if (shouldEnterSystem) {
        this.game.enterSystem(state.currentStar);
      }
    } else if (state.level === 'system') {
      const action = systemView.handleZoom(direction);
      if (action === 'enterOrbit') {
        this.game.enterOrbit(state.currentPlanet);
      } else if (action === 'returnToGalaxy') {
        this.game.returnToGalaxy();
      }
    } else if (state.level === 'orbit') {
      const magnitude = Math.min(
        Math.abs(event.deltaY) / sceneConfig.input.orbitWheelScale,
        1
      );
      const shouldExitOrbit = orbitController.handleZoom(direction, magnitude);
      if (shouldExitOrbit) {
        this.game.exitOrbit();
      }
    }
  }

  dispose() {
    this.domElement.removeEventListener('pointermove', this.boundPointerMove);
    this.domElement.removeEventListener('pointerdown', this.boundPointerDown);
    this.domElement.removeEventListener('pointerleave', this.boundPointerLeave);
    window.removeEventListener('wheel', this.boundWheel);
  }
}
