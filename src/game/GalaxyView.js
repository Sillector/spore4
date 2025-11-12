import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createFollowTarget } from './targets.js';
import { createSeedKey, createWorldRandom } from './random.js';
import { createStarMesh } from './starFactory.js';
import { tickStarMaterial } from './starShader.js';

const galaxyConfig = getConfig('galaxy');
const shipConfig = getConfig('ship');
const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const starWorldPosition = new THREE.Vector3();
const upDirection = new THREE.Vector3(0, 1, 0);

export class GalaxyView {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.config = galaxyConfig;
    this.cameraZoomLimit = Math.max(this.config.zoom.cameraLimit ?? 1, 1e-4);
    this.group = new THREE.Group();
    this.group.rotation.x = THREE.MathUtils.degToRad(this.config.groupTilt.far);
    this.group.name = 'Galaxy';
    this.scene.add(this.group);
    this.hoverSettings = this.createHoverSettings();
    this.populateStars();
    this.hoverState = this.createHoverState();
  }

  populateStars() {
    const temp = new THREE.Vector3();
    this.state.galaxyStars.length = 0;
    for (let i = 0; i < this.config.starCount; i += 1) {
      const starKey = createSeedKey('star', i);
      const starRandom = createWorldRandom('galaxy', starKey);
      const starMesh = createStarMesh('galaxy', starRandom);
      const radius = Math.sqrt(starRandom.next()) * this.config.radius;
      const theta = starRandom.float(0, Math.PI * 2);
      const distanceFactor = 1 - radius / this.config.radius;
      const heightRange = THREE.MathUtils.lerp(
        this.config.heightRange.base,
        this.config.thickness * this.config.heightRange.thicknessFactor,
        distanceFactor
      );
      const y = starRandom.floatSpread(heightRange);
      temp.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
      starMesh.position.copy(temp);
      starMesh.userData.position = temp.clone();
      starMesh.userData.id = i;
      starMesh.userData.seedKey = starKey;
      starMesh.userData.systemSeed = i;
      starMesh.userData.mesh = starMesh;
      this.group.add(starMesh);
      this.state.galaxyStars.push(starMesh.userData);
    }
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
    ship.setTarget(
      createFollowTarget(starData.mesh, this.config.ship.approachAltitude, upDirection)
    );
    ship.setSpeed(shipConfig.speeds.galaxy);
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

    // анимируем шейдер звёзд
    for (const obj of this.group.children) {
      const mat = obj.material;
      if (mat && mat.userData && mat.userData.isStarShader) {
        tickStarMaterial(mat, delta);
      }
    }

    const rawProgress = Math.min(this.state.zoomProgress.galaxy, this.cameraZoomLimit);
    const targetZoom = THREE.MathUtils.clamp(
      rawProgress / this.cameraZoomLimit,
      0,
      1
    );
    const shouldSnap = Boolean(this.state.zoomSnap?.galaxy);
    if (shouldSnap) {
      this.state.zoomSmooth.galaxy = targetZoom;
      this.state.zoomSnap.galaxy = false;
    } else {
      this.state.zoomSmooth.galaxy = THREE.MathUtils.damp(
        this.state.zoomSmooth.galaxy,
        targetZoom,
        this.config.zoom.damping,
        delta
      );
    }
    const zoomNormalized = this.state.zoomSmooth.galaxy;
    const zoom = zoomNormalized * this.cameraZoomLimit;
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
    if (shouldSnap) {
      camera.position.copy(cameraTarget);
    } else {
      camera.position.lerp(cameraTarget, followAlpha);
    }
    camera.lookAt(ship.position);
    const topTilt = THREE.MathUtils.degToRad(this.config.groupTilt.far);
    const closeTilt = THREE.MathUtils.degToRad(this.config.groupTilt.near);
    this.group.rotation.x = THREE.MathUtils.lerp(topTilt, closeTilt, zoomNormalized);
    this.updateHoverVisuals(ship);
  }

  setVisible(value) {
    this.group.visible = value;
    if (!value) {
      this.clearHover();
    }
  }

  setHoveredStar(starData) {
    if (this.hoverState.star === starData) {
      return;
    }
    this.hoverState.star = starData;
    if (!starData) {
      this.clearHover();
    }
  }

  updateHoverVisuals(ship) {
    if (!this.group.visible) {
      this.clearHover();
      return;
    }
    const { star, line, label } = this.hoverState;
    if (!star || !star.mesh) {
      this.clearHover();
      return;
    }
    star.mesh.getWorldPosition(starWorldPosition);
    const shipPosition = ship.position;
    const positions = line.geometry.attributes.position;
    positions.setXYZ(0, shipPosition.x, shipPosition.y, shipPosition.z);
    positions.setXYZ(1, starWorldPosition.x, starWorldPosition.y, starWorldPosition.z);
    positions.needsUpdate = true;
    line.visible = true;

    const distance = shipPosition.distanceTo(starWorldPosition);
    const rounded = distance >= 100 ? distance.toFixed(0) : distance.toFixed(1);
    const distanceLabel = `${rounded} ед.`;
    this.updateLabelTexture(label, distanceLabel);
    label.position.copy(starWorldPosition);
    label.position.y += this.hoverSettings.labelOffset;
    label.visible = true;
  }

  clearHover() {
    const { line, label } = this.hoverState;
    this.hoverState.star = null;
    line.visible = false;
    label.visible = false;
  }

  createHoverState() {
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(6);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: this.hoverSettings.lineColor.clone(),
      transparent: true,
      opacity: this.hoverSettings.lineOpacity
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.visible = false;
    this.scene.add(line);

    const label = this.createDistanceLabel();
    this.scene.add(label);

    return {
      star: null,
      line,
      label
    };
  }

  createDistanceLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.font = '48px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(26, 13, 1);
    sprite.visible = false;
    sprite.userData.canvas = canvas;
    sprite.userData.context = context;
    sprite.userData.texture = texture;
    sprite.userData.text = '';
    return sprite;
  }

  updateLabelTexture(label, text) {
    if (!label || label.userData.text === text) {
      return;
    }
    const { canvas, context, texture } = label.userData;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(0, 0, 0, 0.55)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    texture.needsUpdate = true;
    label.userData.text = text;
  }

  createHoverSettings() {
    const hover = this.config?.star?.hover ?? {};
    const lineColor = new THREE.Color(hover.lineColor ?? 0xffffff);
    return {
      lineColor,
      lineOpacity: hover.lineOpacity ?? 0.65,
      labelOffset: hover.labelOffset ?? 6
    };
  }
}
