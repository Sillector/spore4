import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createWorldRandom } from './random.js';

const backgroundConfig = getConfig('background');
const defaultSkybox = {
  size: 1024,
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

function createSkyboxFace(direction) {
  const skyboxConfig = backgroundConfig.skybox ?? {};
  const size = skyboxConfig.size ?? defaultSkybox.size;
  const topColor = resolveColor(skyboxConfig.topColor, defaultSkybox.topColor);
  const bottomColor = resolveColor(skyboxConfig.bottomColor, defaultSkybox.bottomColor);
  const horizonColor = resolveColor(skyboxConfig.horizonColor, defaultSkybox.horizonColor);
  const glowColor = resolveColor(skyboxConfig.glowColor, defaultSkybox.glowColor);
  const starColor = resolveColor(skyboxConfig.starColor, defaultSkybox.starColor);
  const twinkleIntensity = skyboxConfig.starTwinkle ?? defaultSkybox.starTwinkle;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  const verticalGradient = context.createLinearGradient(0, 0, 0, size);
  verticalGradient.addColorStop(0, toRgba(topColor));
  verticalGradient.addColorStop(0.55, toRgba(horizonColor));
  verticalGradient.addColorStop(1, toRgba(bottomColor));
  context.fillStyle = verticalGradient;
  context.fillRect(0, 0, size, size);

  const centerX = size * 0.5;
  const centerY = size * 0.5;
  const radial = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, size * 0.72);
  const glowInner = glowColor.clone().lerp(new THREE.Color(0xffffff), 0.55);
  radial.addColorStop(0, toRgba(glowInner, 0.85));
  radial.addColorStop(0.45, toRgba(glowColor.clone().lerp(new THREE.Color(0xffffff), 0.25), 0.35));
  radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = radial;
  context.fillRect(0, 0, size, size);

  const rotationMap = {
    px: 0.3,
    nx: -0.3,
    py: 0.6,
    ny: -0.6,
    pz: 0.15,
    nz: -0.15
  };
  const rotation = rotationMap[direction] ?? 0;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation);
  const streak = context.createLinearGradient(-size, 0, size, 0);
  const streakColor = glowColor.clone().lerp(new THREE.Color(0xffffff), 0.4);
  streak.addColorStop(0, 'rgba(0, 0, 0, 0)');
  streak.addColorStop(0.5, toRgba(streakColor, 0.28));
  streak.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = streak;
  context.fillRect(-size, -size, size * 2, size * 2);
  context.restore();

  const random = createWorldRandom('skybox-face', direction);
  const faceStarCount = Math.max(30, Math.floor((backgroundConfig.starCount ?? 1200) / 6));
  const starHighlight = starColor.clone().lerp(new THREE.Color(0xffffff), 0.45);
  context.globalCompositeOperation = 'lighter';
  for (let i = 0; i < faceStarCount; i += 1) {
    const x = random.float(0, size);
    const y = random.float(0, size);
    const baseRadius = random.float(0.35, 1.4);
    const radius = baseRadius * (size / 720);
    const twinkle = 0.35 + random.float(0, twinkleIntensity);
    context.fillStyle = toRgba(starColor, 0.25 + twinkle * 0.55);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    if (random.next() > 0.7) {
      const alpha = 0.1 + twinkle * 0.2;
      context.strokeStyle = toRgba(starHighlight, alpha);
      context.lineWidth = Math.max(0.5, radius * 0.6);
      context.beginPath();
      context.moveTo(x - radius * 3.2, y);
      context.lineTo(x + radius * 3.2, y);
      context.stroke();
      context.beginPath();
      context.moveTo(x, y - radius * 3.2);
      context.lineTo(x, y + radius * 3.2);
      context.stroke();
    }
  }
  context.globalCompositeOperation = 'source-over';

  return canvas;
}

export function createBackgroundSkybox(scene) {
  const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const canvases = faces.map((face) => createSkyboxFace(face));
  const cubeTexture = new THREE.CubeTexture(canvases);
  cubeTexture.needsUpdate = true;
  cubeTexture.colorSpace = THREE.SRGBColorSpace;
  cubeTexture.generateMipmaps = true;
  cubeTexture.minFilter = THREE.LinearMipMapLinearFilter;
  cubeTexture.magFilter = THREE.LinearFilter;
  scene.background = cubeTexture;
  scene.environment = cubeTexture;
}
