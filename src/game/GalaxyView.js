import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createFollowTarget } from './targets.js';
import { createSeedKey, createWorldRandom } from './random.js';
import { createStarMaterial, randomizeStarMaterialOptions } from './shaders/starMaterial.js';

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
    this.starPalette = this.createPalette();
    this.starMaterials = [];
    this.hoverSettings = this.createHoverSettings();
    this.populateStars();
    this.hoverState = this.createHoverState();
  }

  populateStars() {
    const temp = new THREE.Vector3();
    this.state.galaxyStars.length = 0;
    this.starMaterials.length = 0;
    for (let i = 0; i < this.config.starCount; i += 1) {
      const starKey = createSeedKey('star', i);
      const starRandom = createWorldRandom('galaxy', starKey);
      const star = this.createStar(starRandom);
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
      star.position.copy(temp);
      star.userData.position = temp.clone();
      star.userData.id = i;
      star.userData.seedKey = starKey;
      star.userData.systemSeed = i;
      this.group.add(star);
      this.state.galaxyStars.push(star.userData);
    }
  }

  createStar(randomGenerator) {
    const palette = this.starPalette.length ? this.starPalette : STAR_COLOR_PRESETS;
    const preset = randomGenerator.pick(palette) ?? palette[0];
    const hue = THREE.MathUtils.clamp(
      preset.hue + randomGenerator.floatSpread(preset.hueVariance ?? STAR_COLOR_VARIANCE.hue),
      0,
      1
    );
    const saturation = THREE.MathUtils.clamp(
      preset.saturation +
        randomGenerator.floatSpread(
          preset.saturationVariance ?? STAR_COLOR_VARIANCE.saturation
        ),
      0,
      1
    );
    const lightness = THREE.MathUtils.clamp(
      preset.lightness +
        randomGenerator.floatSpread(
          preset.lightnessVariance ?? STAR_COLOR_VARIANCE.lightness
        ),
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
    const material = createStarMaterial(
      randomizeStarMaterialOptions(randomGenerator, {
        color,
        glowStrength: emissiveMultiplier
      })
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const nameMin = this.config.star.name.min;
    const nameMax = nameMin + this.config.star.name.maxRange - 1;
    mesh.userData = {
      name: `${this.config.star.name.prefix}${randomGenerator.int(nameMin, nameMax)}`,
      color,
      mesh
    };
    mesh.userData.mesh = mesh;
    this.starMaterials.push(material);
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
    this.updateStarMaterials(delta);
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
    this.applyStarHighlight(this.hoverState.star, false);
    this.hoverState.star = starData;
    if (!starData) {
      this.clearHover();
      return;
    }
    this.applyStarHighlight(starData, true);
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
    const { star, line, label } = this.hoverState;
    if (star) {
      this.applyStarHighlight(star, false);
    }
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

  applyStarHighlight(starData, isActive) {
    if (!starData?.mesh) {
      return;
    }
    const material = starData.mesh.material;
    if (!material?.userData) {
      return;
    }
    material.userData.targetHighlight = isActive ? 1 : 0;
  }

  updateStarMaterials(delta) {
    const damping = this.config?.star?.highlightDamping ?? 6;
    for (const material of this.starMaterials) {
      if (!material?.uniforms?.time) {
        continue;
      }
      const timeScale = material.userData?.timeScale ?? 1;
      material.uniforms.time.value += delta * timeScale;
      const data = material.userData;
      if (!data) {
        continue;
      }
      const current = data.currentHighlight ?? 0;
      const target = data.targetHighlight ?? 0;
      const nextValue = THREE.MathUtils.damp(current, target, damping, delta);
      data.currentHighlight = nextValue;
      material.uniforms.highlight.value = nextValue;
    }
  }
}
