import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createFollowTarget } from './targets.js';

const STAR_COLOR_PRESETS = [
  { hue: 0.02, saturation: 0.78, lightness: 0.56, emissiveMultiplier: 0.8 },
  { hue: 0.12, saturation: 0.72, lightness: 0.62, emissiveMultiplier: 0.75 },
  { hue: 0, saturation: 0.04, lightness: 0.92, emissiveMultiplier: 0.7 },
  { hue: 0.58, saturation: 0.64, lightness: 0.68, emissiveMultiplier: 0.85 }
];
const STAR_COLOR_VARIANCE = {
  hue: 0.015,
  saturation: 0.06,
  lightness: 0.05
};

const galaxyConfig = getConfig('galaxy');
const shipConfig = getConfig('ship');
const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const starWorldPosition = new THREE.Vector3();

export class GalaxyView {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.config = galaxyConfig;
    this.group = new THREE.Group();
    this.group.rotation.x = THREE.MathUtils.degToRad(this.config.groupTilt.far);
    this.group.name = 'Galaxy';
    this.scene.add(this.group);
    this.starPalette = this.createPalette();
    this.hoverSettings = this.createHoverSettings();
    this.populateStars();
    this.hoverState = this.createHoverState();
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
    const palette = this.starPalette.length ? this.starPalette : STAR_COLOR_PRESETS;
    const preset = palette[Math.floor(Math.random() * palette.length)];
    const hue = THREE.MathUtils.clamp(
      preset.hue + THREE.MathUtils.randFloatSpread(preset.hueVariance ?? STAR_COLOR_VARIANCE.hue),
      0,
      1
    );
    const saturation = THREE.MathUtils.clamp(
      preset.saturation +
        THREE.MathUtils.randFloatSpread(
          preset.saturationVariance ?? STAR_COLOR_VARIANCE.saturation
        ),
      0,
      1
    );
    const lightness = THREE.MathUtils.clamp(
      preset.lightness +
        THREE.MathUtils.randFloatSpread(preset.lightnessVariance ?? STAR_COLOR_VARIANCE.lightness),
      0,
      1
    );
    const color = new THREE.Color().setHSL(hue, saturation, lightness);
    const emissiveMultiplier =
      preset.emissiveMultiplier ?? this.config.star.color.emissiveMultiplier ?? 1;
    const geometry = new THREE.SphereGeometry(
      this.config.star.geometry.radius,
      this.config.star.geometry.widthSegments,
      this.config.star.geometry.heightSegments
    );
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color
        .clone()
        .multiplyScalar(emissiveMultiplier),
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
    const threshold = Math.max(this.config.zoom.enterThreshold, 1e-5);
    const targetZoom = THREE.MathUtils.clamp(
      this.state.zoomProgress.galaxy / threshold,
      0,
      1
    );
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

  createPalette() {
    const palette = this.config?.star?.color?.palette;
    const varianceDefaults = this.config?.star?.color?.variance ?? {};
    const defaultVariance = {
      hue: varianceDefaults.hue ?? STAR_COLOR_VARIANCE.hue,
      saturation: varianceDefaults.saturation ?? STAR_COLOR_VARIANCE.saturation,
      lightness: varianceDefaults.lightness ?? STAR_COLOR_VARIANCE.lightness
    };
    const defaultEmissive = this.config?.star?.color?.emissiveMultiplier ?? 1;
    if (Array.isArray(palette) && palette.length > 0) {
      return palette.map((preset) => ({
        hue: preset.hue ?? 0,
        saturation: preset.saturation ?? 0.7,
        lightness: preset.lightness ?? 0.6,
        hueVariance:
          preset.hueVariance ?? preset.variance?.hue ?? defaultVariance.hue,
        saturationVariance:
          preset.saturationVariance ?? preset.variance?.saturation ?? defaultVariance.saturation,
        lightnessVariance:
          preset.lightnessVariance ?? preset.variance?.lightness ?? defaultVariance.lightness,
        emissiveMultiplier: preset.emissiveMultiplier ?? defaultEmissive
      }));
    }
    return STAR_COLOR_PRESETS.map((preset) => ({
      hue: preset.hue,
      saturation: preset.saturation,
      lightness: preset.lightness,
      hueVariance: defaultVariance.hue,
      saturationVariance: defaultVariance.saturation,
      lightnessVariance: defaultVariance.lightness,
      emissiveMultiplier: preset.emissiveMultiplier ?? defaultEmissive
    }));
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
