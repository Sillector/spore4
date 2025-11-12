import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createWorldRandom } from './random.js';

const backgroundConfig = getConfig('background');
const defaultSkybox = {
  size: 2048,
  radius: 2400,
  horizontalRepeat: 2,
  topColor: '#0b1029',
  bottomColor: '#03040f',
  horizonColor: '#16204a',
  glowColor: '#2840a9',
  starColor: '#d4e7ff',
  starTwinkle: 0.55
};

function resolveColor(value, fallback) {
  return new THREE.Color(value ?? fallback);
}

function toRgba(color, alpha = 1) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createSkySphereTexture() {
  const skyboxConfig = backgroundConfig.skybox ?? {};
  const size = skyboxConfig.size ?? defaultSkybox.size;
  const repeatRaw = skyboxConfig.horizontalRepeat ?? defaultSkybox.horizontalRepeat;
  const horizontalRepeat = Math.max(1, repeatRaw);
  const topColor = resolveColor(skyboxConfig.topColor, defaultSkybox.topColor);
  const bottomColor = resolveColor(skyboxConfig.bottomColor, defaultSkybox.bottomColor);
  const horizonColor = resolveColor(skyboxConfig.horizonColor, defaultSkybox.horizonColor);
  const glowColor = resolveColor(skyboxConfig.glowColor, defaultSkybox.glowColor);
  const starColor = resolveColor(skyboxConfig.starColor, defaultSkybox.starColor);
  const twinkleIntensity = skyboxConfig.starTwinkle ?? defaultSkybox.starTwinkle;

  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size;
  const context = canvas.getContext('2d');

  const verticalGradient = context.createLinearGradient(0, 0, 0, canvas.height);
  verticalGradient.addColorStop(0, toRgba(topColor));
  verticalGradient.addColorStop(0.45, toRgba(horizonColor));
  verticalGradient.addColorStop(1, toRgba(bottomColor));
  context.fillStyle = verticalGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const horizonBand = context.createLinearGradient(0, canvas.height * 0.45, 0, canvas.height * 0.65);
  horizonBand.addColorStop(0, toRgba(horizonColor.clone().lerp(new THREE.Color('#ffffff'), 0.25), 0.35));
  horizonBand.addColorStop(0.5, toRgba(glowColor.clone().lerp(new THREE.Color('#ffffff'), 0.4), 0.25));
  horizonBand.addColorStop(1, toRgba(horizonColor, 0.2));
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = horizonBand;
  context.fillRect(0, canvas.height * 0.3, canvas.width, canvas.height * 0.6);

  const glowGradient = context.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.height * 0.05,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.75
  );
  glowGradient.addColorStop(0, toRgba(glowColor.clone().lerp(new THREE.Color('#ffffff'), 0.2), 0.25));
  glowGradient.addColorStop(0.25, toRgba(glowColor, 0.18));
  glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = glowGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const auroraGradient = context.createLinearGradient(0, 0, canvas.width, 0);
  auroraGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  auroraGradient.addColorStop(0.2, toRgba(glowColor.clone().lerp(new THREE.Color('#ffffff'), 0.15), 0.1));
  auroraGradient.addColorStop(0.5, toRgba(glowColor.clone().lerp(new THREE.Color('#ffffff'), 0.3), 0.18));
  auroraGradient.addColorStop(0.8, toRgba(glowColor.clone().lerp(new THREE.Color('#ffffff'), 0.15), 0.1));
  auroraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.save();
  context.translate(canvas.width * 0.5, canvas.height * 0.5);
  context.rotate(0.15);
  context.fillStyle = auroraGradient;
  context.fillRect(-canvas.width, -canvas.height * 0.4, canvas.width * 2, canvas.height * 0.8);
  context.restore();

  const random = createWorldRandom('sky-sphere');
  const totalStars = Math.max(180, backgroundConfig.starCount ?? 1200);
  const starHighlight = starColor.clone().lerp(new THREE.Color(0xffffff), 0.45);
  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let i = 0; i < totalStars; i += 1) {
    const u = random.next();
    const v = random.next();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const x = (theta / (Math.PI * 2)) * canvas.width;
    const y = (phi / Math.PI) * canvas.height;
    const baseRadius = random.float(0.35, 1.4);
    const radius = baseRadius * (canvas.height / 720);
    const outerRadius = radius * 3.4;
    const twinkle = 0.35 + random.float(0, twinkleIntensity);

    const coreGradient = context.createRadialGradient(x, y, 0, x, y, outerRadius);
    coreGradient.addColorStop(0, toRgba(starHighlight, 0.75 + twinkle * 0.15));
    coreGradient.addColorStop(0.45, toRgba(starColor, 0.55 + twinkle * 0.3));
    coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = coreGradient;
    context.beginPath();
    context.arc(x, y, outerRadius, 0, Math.PI * 2);
    context.fill();

    if (random.next() > 0.72) {
      const alpha = 0.04 + twinkle * 0.18;
      context.strokeStyle = toRgba(starHighlight, alpha);
      context.lineWidth = Math.max(0.3, radius * 0.45);
      context.beginPath();
      context.moveTo(x - radius * 3.1, y);
      context.lineTo(x + radius * 3.1, y);
      context.stroke();
      context.beginPath();
      context.moveTo(x, y - radius * 3.1);
      context.lineTo(x, y + radius * 3.1);
      context.stroke();
    }
  }
  context.restore();

  return { canvas, horizontalRepeat };
}

export function createBackgroundSkybox(scene, camera) {
  const existing = scene.getObjectByName('SkySphere');
  if (existing) {
    scene.remove(existing);
    if (existing.material?.map) {
      existing.material.map.dispose();
    }
    existing.material?.dispose?.();
    existing.geometry?.dispose?.();
  }

  const { canvas, horizontalRepeat } = createSkySphereTexture();
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(horizontalRepeat, 1);
  texture.needsUpdate = true;

  const skyboxConfig = backgroundConfig.skybox ?? {};
  const radius = Math.max(10, skyboxConfig.radius ?? defaultSkybox.radius);
  if (camera) {
    const padding = Math.max(10, radius * 0.05);
    if (camera.far <= radius + padding) {
      camera.far = radius + padding;
      camera.updateProjectionMatrix();
    }
  }
  const geometry = new THREE.SphereGeometry(radius, 64, 48);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const skySphere = new THREE.Mesh(geometry, material);
  skySphere.name = 'SkySphere';
  skySphere.frustumCulled = false;
  scene.add(skySphere);
  scene.background = null;
  scene.environment = texture;
  return skySphere;
}
