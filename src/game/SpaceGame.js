import * as THREE from 'three';
import { GameState } from './GameState.js';
import { GalaxyView } from './GalaxyView.js';
import { SystemView } from './SystemView.js';
import { OrbitController } from './OrbitController.js';
import { ShipController } from './ShipController.js';
import { createBackgroundNebula } from './background.js';
import { createFollowTarget, createPointTarget } from './targets.js';
import { getConfig } from '../config/store.js';
import { MouseInputSystem } from './MouseInputSystem.js';
import { PlayerStore } from './playerStore.js';

const sceneConfig = getConfig('scene');
const galaxyConfig = getConfig('galaxy');
const shipConfig = getConfig('ship');
const upDirection = new THREE.Vector3(0, 1, 0);

export class SpaceGame {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: sceneConfig.renderer.antialias });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, sceneConfig.renderer.pixelRatioMax)
    );
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(sceneConfig.scene.backgroundColor);

    this.camera = new THREE.PerspectiveCamera(
      sceneConfig.camera.fov,
      container.clientWidth / container.clientHeight,
      sceneConfig.camera.near,
      sceneConfig.camera.far
    );
    this.camera.position.set(
      sceneConfig.camera.initialPosition.x,
      sceneConfig.camera.initialPosition.y,
      sceneConfig.camera.initialPosition.z
    );

    this.state = new GameState();
    this.playerStore = new PlayerStore();
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this.ship = new ShipController(this.scene);
    this.galaxyView = new GalaxyView(this.scene, this.state);
    this.systemView = new SystemView(this.scene, this.state);
    this.orbitController = new OrbitController(this.scene, this.state);

    this.cameraBaseOffset = new THREE.Vector3(
      galaxyConfig.cameraBaseOffset.x,
      galaxyConfig.cameraBaseOffset.y,
      galaxyConfig.cameraBaseOffset.z
    );

    this.hoveredStar = null;

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.setupLights();
    this.background = createBackgroundNebula(this.scene);

    const restored = this.restorePlayerState();
    if (!restored) {
      this.initializeStartingStar();
    }
    this.mouseInput = null;
    this.bindEvents();
    this.animate = this.animate.bind(this);
    this.playerStore.syncFromState(this.state);
    this.animate();
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(
      new THREE.Color(sceneConfig.lights.ambient.color),
      sceneConfig.lights.ambient.intensity
    );
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(
      new THREE.Color(sceneConfig.lights.directional.color),
      sceneConfig.lights.directional.intensity
    );
    dirLight.position.set(
      sceneConfig.lights.directional.position.x,
      sceneConfig.lights.directional.position.y,
      sceneConfig.lights.directional.position.z
    );
    dirLight.castShadow = true;
    this.scene.add(dirLight);
  }

  initializeStartingStar() {
    const closest = this.galaxyView.findClosestStar();
    if (!closest) return;
    this.galaxyView.moveShipToStar(this.ship, closest);
    this.ship.snapToTarget();
    this.camera.position.copy(this.ship.position).add(this.cameraBaseOffset);
    this.camera.lookAt(this.ship.position);
  }

  restorePlayerState() {
    if (!this.playerStore) {
      return false;
    }
    const snapshot = this.playerStore.getSnapshot();
    if (!snapshot || snapshot.currentStarId === null) {
      return false;
    }
    const starData = this.state.galaxyStars.find((star) => star.id === snapshot.currentStarId);
    if (!starData) {
      return false;
    }
    this.galaxyView.moveShipToStar(this.ship, starData);
    this.ship.snapToTarget();
    this.camera.position.copy(this.ship.position).add(this.cameraBaseOffset);
    this.camera.lookAt(this.ship.position);
    this.state.level = 'galaxy';
    this.state.resetZoom('galaxy');
    if (snapshot.state === 'galaxy') {
      this.galaxyView.setVisible(true);
      this.systemView.setVisible(false);
      return true;
    }
    this.galaxyView.setVisible(false);
    this.hoveredStar = null;
    this.galaxyView.setHoveredStar(null);
    this.systemView.setHoveredPlanet(null);
    this.systemView.enter(starData, this.ship, this.camera, { autoSelectFirstPlanet: false });
    let planetData = null;
    if (snapshot.currentPlanetId !== null && this.state.currentSystem) {
      planetData = this.state.currentSystem.planets.find(
        (planet) => planet.id === snapshot.currentPlanetId
      );
    }
    if (!planetData && snapshot.state === 'system' && this.state.currentSystem) {
      planetData = this.state.currentSystem.planets[0] ?? null;
    }
    if (planetData) {
      this.systemView.moveShipToPlanet(this.ship, planetData);
      this.ship.snapToTarget();
    }
    if (snapshot.state === 'planet' && planetData) {
      this.enterOrbit(planetData);
    } else {
      this.systemView.setVisible(true);
      this.state.level = 'system';
      this.state.resetZoom('system');
    }
    return true;
  }

  bindEvents() {
    this.mouseInput = new MouseInputSystem(this);
    this.boundKeyDown = (event) => this.onKeyChange(event);
    this.boundKeyUp = (event) => this.onKeyChange(event);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  onKeyChange(event) {
    if (event.type === 'keydown') {
      this.state.pressedKeys.add(event.code);
    } else {
      this.state.pressedKeys.delete(event.code);
    }
  }

  pickIntersectables() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.state.level === 'galaxy') {
      return this.galaxyView.pick(this.raycaster);
    }
    if (this.state.level === 'system') {
      return this.systemView.pick(this.raycaster);
    }
    return [];
  }

  enterSystem(starData) {
    if (!starData) return;
    this.state.level = 'transition';
    this.systemView.setHoveredPlanet(null);
    this.hoveredStar = null;
    this.galaxyView.setHoveredStar(null);
    this.galaxyView.setVisible(false);
    this.orbitController.exit(this.ship, null);
    this.systemView.enter(starData, this.ship, this.camera);
  }

  returnToGalaxy() {
    this.systemView.exit();
    this.orbitController.exit(this.ship, null);
    this.galaxyView.setVisible(true);
    this.systemView.setHoveredPlanet(null);
    const target = this.state.currentStar
      ? createFollowTarget(
          this.state.currentStar.mesh,
          galaxyConfig.ship.approachAltitude,
          upDirection
        )
      : createPointTarget(new THREE.Vector3());
    this.ship.setTarget(target);
    this.ship.setSpeed(shipConfig.speeds.galaxy);
    this.ship.snapToTarget();
    this.camera.position.copy(this.ship.position).add(this.cameraBaseOffset);
    this.camera.lookAt(this.ship.position);
    this.state.level = 'galaxy';
    this.state.currentPlanet = null;
    this.state.resetZoom();
    this.updateHoverSelection();
  }

  enterOrbit(planetData) {
    if (!planetData) return;
    this.systemView.setHoveredPlanet(null);
    this.systemView.setVisible(false);
    this.orbitController.enter(planetData, this.ship, this.camera);
  }

  exitOrbit() {
    this.orbitController.exit(this.ship, this.state.currentPlanet);
    this.systemView.setVisible(true);
  }

  handleResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  updateSystemHover() {
    const intersects = this.pickIntersectables();
    if (!intersects.length) {
      this.systemView.setHoveredPlanet(null);
      return;
    }
    const planet = intersects[0].object.userData;
    if (!planet?.mesh) {
      this.systemView.setHoveredPlanet(null);
      return;
    }
    this.systemView.setHoveredPlanet(planet);
  }

  animate() {
    const delta = this.clock.getDelta();
    this.ship.update(delta);
    if (this.state.level === 'orbit') {
      this.orbitController.update(delta, this.ship, this.camera);
    } else if (this.state.level === 'system') {
      this.systemView.update(delta, this.ship, this.camera);
    } else if (this.state.level === 'galaxy') {
      this.galaxyView.update(delta, this.ship, this.camera);
    } else if (this.state.level === 'transition') {
      this.camera.lookAt(this.ship.position);
    }
    this.background?.update(this.clock.elapsedTime);
    this.renderer.render(this.scene, this.camera);
    this.playerStore?.syncFromState(this.state);
    requestAnimationFrame(this.animate);
  }

  updateHoverSelection() {
    if (this.state.level !== 'galaxy') {
      this.hoveredStar = null;
      this.galaxyView.setHoveredStar(null);
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.galaxyView.pick(this.raycaster);
    const starData = intersects.length ? intersects[0].object.userData : null;
    if (starData !== this.hoveredStar) {
      this.hoveredStar = starData;
      this.galaxyView.setHoveredStar(starData);
    }
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.ship.dispose();
    if (this.mouseInput) {
      this.mouseInput.dispose();
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
    }
    if (this.boundKeyUp) {
      window.removeEventListener('keyup', this.boundKeyUp);
    }
    if (this.playerStore) {
      this.playerStore.dispose();
      this.playerStore = null;
    }
    if (this.background) {
      this.background.dispose();
      this.background = null;
    }
  }
}

export function createSpaceGame(container) {
  const game = new SpaceGame(container);
  return {
    dispose() {
      game.dispose();
    }
  };
}
