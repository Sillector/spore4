import * as THREE from 'three';
import {
  PLANETS_PER_SYSTEM,
  SYSTEM_SPEED,
  SYSTEM_ZOOM_STEP
} from './constants.js';
import { createFollowTarget, createPointTarget } from './targets.js';

const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();

export class SystemView {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.wrapper = null;
  }

  pick(raycaster) {
    if (!this.state.currentSystem) return [];
    const meshes = this.state.currentSystem.planets.map((planet) => planet.mesh);
    return raycaster.intersectObjects(meshes, false);
  }

  moveShipToPlanet(ship, planetData) {
    this.state.currentPlanet = planetData;
    ship.setTarget(createFollowTarget(planetData.mesh, planetData.radius + 3));
    ship.setSpeed(SYSTEM_SPEED);
    this.state.resetZoom('system');
  }

  handleZoom(direction) {
    if (direction > 0 && this.state.currentPlanet) {
      this.state.zoomProgress.system = Math.min(
        1,
        this.state.zoomProgress.system + SYSTEM_ZOOM_STEP
      );
      if (this.state.zoomProgress.system >= 1) {
        this.state.zoomProgress.system = 0;
        return 'enterOrbit';
      }
    } else if (direction < 0) {
      this.state.zoomProgress.system = Math.max(
        -1,
        this.state.zoomProgress.system - SYSTEM_ZOOM_STEP
      );
      if (this.state.zoomProgress.system <= -1) {
        this.state.zoomProgress.system = 0;
        return 'returnToGalaxy';
      }
    }
    return null;
  }

  buildSystem(starData) {
    const group = new THREE.Group();
    const starCore = new THREE.Mesh(
      new THREE.SphereGeometry(4, 32, 32),
      new THREE.MeshStandardMaterial({
        color: starData.color,
        emissive: starData.color.clone().multiplyScalar(1.6),
        emissiveIntensity: 2.5,
        roughness: 0.1
      })
    );
    starCore.castShadow = true;
    starCore.receiveShadow = true;
    group.add(starCore);

    const planets = [];
    let orbitRadius = 12;
    for (let i = 0; i < PLANETS_PER_SYSTEM; i += 1) {
      const radius = THREE.MathUtils.randFloat(1.5, 3.8);
      const hue = (starData.systemSeed + i * 0.13) % 1;
      const color = new THREE.Color().setHSL(hue, 0.6, 0.5);
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.7,
          metalness: 0.1
        })
      );
      const orbitAngle = Math.random() * Math.PI * 2;
      planet.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        THREE.MathUtils.randFloat(-1.5, 1.5),
        Math.sin(orbitAngle) * orbitRadius
      );
      planet.castShadow = true;
      planet.receiveShadow = true;
      planet.userData = {
        name: `Планета ${i + 1}`,
        radius,
        mesh: planet
      };
      group.add(planet);
      planets.push({ ...planet.userData, mesh: planet });
      orbitRadius += THREE.MathUtils.randFloat(6, 11);
    }

    const asteroidBelt = this.createAsteroidBelt(24, 42, 1600);
    group.add(asteroidBelt);

    this.wrapper = { group, star: starCore, planets };
    this.state.currentSystem = this.wrapper;
    return this.wrapper;
  }

  createAsteroidBelt(inner, outer, count) {
    const geometry = new THREE.IcosahedronGeometry(0.35, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 1,
      metalness: 0
    });
    const belt = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const radius = THREE.MathUtils.randFloat(inner, outer);
      const angle = Math.random() * Math.PI * 2;
      const height = THREE.MathUtils.randFloatSpread(2.8);
      dummy.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      dummy.scale.setScalar(THREE.MathUtils.randFloat(0.4, 1.2));
      dummy.updateMatrix();
      belt.setMatrixAt(i, dummy.matrix);
    }
    return belt;
  }

  enter(starData, ship, camera) {
    if (this.wrapper) {
      this.scene.remove(this.wrapper.group);
    }
    const system = this.buildSystem(starData);
    this.scene.add(system.group);
    ship.position.set(0, 0, 35);
    ship.setTarget(createPointTarget(new THREE.Vector3(0, 0, 25)));
    ship.setSpeed(SYSTEM_SPEED);
    camera.position.set(0, 28, 82);
    camera.lookAt(0, 0, 0);
    this.state.resetZoom();
    this.state.currentStar = starData;
    this.state.currentPlanet = null;
    this.state.level = 'system';
  }

  exit() {
    if (!this.wrapper) return;
    this.scene.remove(this.wrapper.group);
    this.wrapper = null;
    this.state.currentSystem = null;
    this.state.currentPlanet = null;
  }

  update(delta, ship, camera) {
    if (!this.wrapper) return;
    this.wrapper.group.rotation.y += delta * 0.05;
    const targetZoom = this.state.zoomProgress.system;
    this.state.zoomSmooth.system = THREE.MathUtils.damp(
      this.state.zoomSmooth.system,
      targetZoom,
      6,
      delta
    );
    const zoom = this.state.zoomSmooth.system;
    let offsetY = 18;
    let offsetZ = 48;
    if (zoom >= 0) {
      offsetY = THREE.MathUtils.lerp(18, 12, zoom);
      offsetZ = THREE.MathUtils.lerp(48, 32, zoom);
    } else {
      const amount = -zoom;
      offsetY = THREE.MathUtils.lerp(18, 26, amount);
      offsetZ = THREE.MathUtils.lerp(48, 72, amount);
    }
    cameraOffset.set(0, offsetY, offsetZ);
    cameraTarget.copy(ship.position).add(cameraOffset);
    const followAlpha = THREE.MathUtils.clamp(delta * 4.5, 0.05, 0.16);
    camera.position.lerp(cameraTarget, followAlpha);
    camera.lookAt(ship.position);
  }

  setVisible(value) {
    if (this.wrapper) {
      this.wrapper.group.visible = value;
    }
  }
}
