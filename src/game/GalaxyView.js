import * as THREE from 'three';
import {
  STAR_COUNT,
  GALAXY_RADIUS,
  GALAXY_THICKNESS,
  GALAXY_ZOOM_STEP,
  GALAXY_ENTER_THRESHOLD,
  SHIP_SPEED
} from './constants.js';
import { createFollowTarget } from './targets.js';

const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();

export class GalaxyView {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.group = new THREE.Group();
    this.group.rotation.x = THREE.MathUtils.degToRad(78);
    this.group.name = 'Galaxy';
    this.scene.add(this.group);
    this.populateStars();
  }

  populateStars() {
    const temp = new THREE.Vector3();
    this.state.galaxyStars.length = 0;
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const star = this.createStar();
      const radius = Math.sqrt(Math.random()) * GALAXY_RADIUS;
      const theta = Math.random() * Math.PI * 2;
      const distanceFactor = 1 - radius / GALAXY_RADIUS;
      const heightRange = THREE.MathUtils.lerp(0.6, GALAXY_THICKNESS * 0.17, distanceFactor);
      const y = THREE.MathUtils.randFloatSpread(heightRange);
      temp.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
      star.position.copy(temp);
      star.userData.position = temp.clone();
      star.userData.systemSeed = Math.random();
      this.group.add(star);
      this.state.galaxyStars.push(star.userData);
    }
  }

  createStar() {
    const color = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.8, 0.6);
    const geometry = new THREE.SphereGeometry(1.4, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color.clone().multiplyScalar(0.6),
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      name: `Система ${Math.floor(Math.random() * 900 + 100)}`,
      color,
      mesh
    };
    mesh.userData.mesh = mesh;
    return mesh;
  }

  findClosestStar() {
    if (!this.state.galaxyStars.length) return null;
    let closest = this.state.galaxyStars[0];
    let closestDistanceSq = closest.position.lengthSq();
    for (let i = 1; i < this.state.galaxyStars.length; i += 1) {
      const candidate = this.state.galaxyStars[i];
      const distanceSq = candidate.position.lengthSq();
      if (distanceSq < closestDistanceSq) {
        closest = candidate;
        closestDistanceSq = distanceSq;
      }
    }
    return closest;
  }

  moveShipToStar(ship, starData) {
    this.state.currentStar = starData;
    ship.setTarget(createFollowTarget(starData.mesh, 6));
    ship.setSpeed(SHIP_SPEED);
    this.state.resetZoom('galaxy');
  }

  handleZoom(direction) {
    if (direction > 0 && this.state.currentStar) {
      this.state.zoomProgress.galaxy = Math.min(
        GALAXY_ENTER_THRESHOLD,
        this.state.zoomProgress.galaxy + GALAXY_ZOOM_STEP
      );
      if (this.state.zoomProgress.galaxy >= GALAXY_ENTER_THRESHOLD) {
        this.state.zoomProgress.galaxy = 0;
        return true;
      }
    } else if (direction < 0) {
      this.state.zoomProgress.galaxy = Math.max(
        0,
        this.state.zoomProgress.galaxy - GALAXY_ZOOM_STEP
      );
    }
    return false;
  }

  pick(raycaster) {
    return raycaster.intersectObjects(this.group.children, false);
  }

  update(delta, ship, camera) {
    this.group.rotation.y += delta * 0.01;
    const targetZoom = Math.min(this.state.zoomProgress.galaxy, 1);
    this.state.zoomSmooth.galaxy = THREE.MathUtils.damp(
      this.state.zoomSmooth.galaxy,
      targetZoom,
      6,
      delta
    );
    const zoom = this.state.zoomSmooth.galaxy;
    const targetY = THREE.MathUtils.lerp(72, 34, zoom);
    const targetZ = THREE.MathUtils.lerp(215, 122, zoom);
    cameraOffset.set(0, targetY, targetZ);
    cameraTarget.copy(ship.position).add(cameraOffset);
    const followAlpha = THREE.MathUtils.clamp(delta * 4.5, 0.05, 0.16);
    camera.position.lerp(cameraTarget, followAlpha);
    camera.lookAt(ship.position);
    const topTilt = THREE.MathUtils.degToRad(78);
    const closeTilt = THREE.MathUtils.degToRad(45);
    this.group.rotation.x = THREE.MathUtils.lerp(topTilt, closeTilt, zoom);
  }

  setVisible(value) {
    this.group.visible = value;
  }
}
