import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createFollowTarget } from './targets.js';

const galaxyConfig = getConfig('galaxy');
const shipConfig = getConfig('ship');
const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();

export class GalaxyView {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.config = galaxyConfig;
    this.group = new THREE.Group();
    this.group.rotation.x = THREE.MathUtils.degToRad(this.config.groupTilt.far);
    this.group.name = 'Galaxy';
    this.scene.add(this.group);
    this.populateStars();
  }

  populateStars() {
    const temp = new THREE.Vector3();
    this.state.galaxyStars.length = 0;
    for (let i = 0; i < this.config.starCount; i += 1) {
      const star = this.createStar();
      const radius = Math.sqrt(Math.random()) * this.config.radius;
      const theta = Math.random() * Math.PI * 2;
      const distanceFactor = 1 - radius / this.config.radius;
      const heightRange = THREE.MathUtils.lerp(
        this.config.heightRange.base,
        this.config.thickness * this.config.heightRange.thicknessFactor,
        distanceFactor
      );
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
    const color = new THREE.Color().setHSL(
      this.config.star.color.hueBase + Math.random() * this.config.star.color.hueVariance,
      this.config.star.color.saturation,
      this.config.star.color.lightness
    );
    const geometry = new THREE.SphereGeometry(
      this.config.star.geometry.radius,
      this.config.star.geometry.widthSegments,
      this.config.star.geometry.heightSegments
    );
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color.clone().multiplyScalar(this.config.star.color.emissiveMultiplier),
      emissiveIntensity: this.config.star.material.emissiveIntensity,
      roughness: this.config.star.material.roughness,
      metalness: this.config.star.material.metalness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      name: `${this.config.star.name.prefix}${Math.floor(
        Math.random() * this.config.star.name.maxRange + this.config.star.name.min
      )}`,
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
    ship.setTarget(createFollowTarget(starData.mesh, this.config.ship.approachAltitude));
    ship.setSpeed(shipConfig.speeds.galaxy);
    this.state.resetZoom('galaxy');
  }

  handleZoom(direction) {
    if (direction > 0 && this.state.currentStar) {
      this.state.zoomProgress.galaxy = Math.min(
        this.config.zoom.enterThreshold,
        this.state.zoomProgress.galaxy + this.config.zoom.step
      );
      if (this.state.zoomProgress.galaxy >= this.config.zoom.enterThreshold) {
        this.state.zoomProgress.galaxy = 0;
        return true;
      }
    } else if (direction < 0) {
      this.state.zoomProgress.galaxy = Math.max(
        0,
        this.state.zoomProgress.galaxy - this.config.zoom.step
      );
    }
    return false;
  }

  pick(raycaster) {
    return raycaster.intersectObjects(this.group.children, false);
  }

  update(delta, ship, camera) {
    this.group.rotation.y += delta * this.config.rotationSpeed;
    const targetZoom = Math.min(this.state.zoomProgress.galaxy, 1);
    this.state.zoomSmooth.galaxy = THREE.MathUtils.damp(
      this.state.zoomSmooth.galaxy,
      targetZoom,
      this.config.zoom.damping,
      delta
    );
    const zoom = this.state.zoomSmooth.galaxy;
    const targetY = THREE.MathUtils.lerp(
      this.config.camera.offset.startY,
      this.config.camera.offset.endY,
      zoom
    );
    const targetZ = THREE.MathUtils.lerp(
      this.config.camera.offset.startZ,
      this.config.camera.offset.endZ,
      zoom
    );
    cameraOffset.set(0, targetY, targetZ);
    cameraTarget.copy(ship.position).add(cameraOffset);
    const followAlpha = THREE.MathUtils.clamp(
      delta * this.config.camera.follow.rate,
      this.config.camera.follow.min,
      this.config.camera.follow.max
    );
    camera.position.lerp(cameraTarget, followAlpha);
    camera.lookAt(ship.position);
    const topTilt = THREE.MathUtils.degToRad(this.config.groupTilt.far);
    const closeTilt = THREE.MathUtils.degToRad(this.config.groupTilt.near);
    this.group.rotation.x = THREE.MathUtils.lerp(topTilt, closeTilt, zoom);
  }

  setVisible(value) {
    this.group.visible = value;
  }
}
