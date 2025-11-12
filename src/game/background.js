import * as THREE from 'three';
import { getConfig } from '../config/store.js';

const backgroundConfig = getConfig('background');

const vertexShader = `
  uniform float uTime;
  uniform float uPulseSpeed;
  attribute vec3 color;
  attribute float size;
  attribute float timeOffset;
  varying vec3 vColor;
  varying float vCycle;
  varying float vPulse;

  void main() {
    float cycle = fract(uTime * uPulseSpeed + timeOffset);
    float pulse = 0.5 + 0.5 * sin(cycle * 6.28318530718);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distanceScale = 300.0 / max(1.0, -mvPosition.z);
    float sizeMultiplier = mix(0.6, 1.8, pulse);
    gl_PointSize = clamp(size * sizeMultiplier * distanceScale, 0.0, 120.0);
    vColor = color;
    vCycle = cycle;
    vPulse = pulse;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  precision highp float;
  uniform float uBaseOpacity;
  uniform float uHaloIntensity;
  varying vec3 vColor;
  varying float vCycle;
  varying float vPulse;

  float gaussian(float x, float offset, float variance) {
    float diff = x - offset;
    return exp(-(diff * diff) / (2.0 * variance));
  }

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    float core = 1.0 - smoothstep(0.0, 0.22, dist);
    float glow = 1.0 - smoothstep(0.3, 0.6, dist);
    float ringRadius = mix(0.12, 0.48, vCycle);
    float explosion = gaussian(dist, ringRadius, 0.006);
    float pulseGlow = mix(0.8, 1.4, vPulse);
    float halo = glow * uHaloIntensity * pulseGlow;
    float alpha = (core * 0.9 + halo + explosion * 1.2) * uBaseOpacity;
    vec3 explosionTint = vec3(1.0, 0.85, 0.55);
    vec3 baseColor = vColor * mix(0.8, 1.6, vPulse);
    vec3 finalColor = mix(baseColor, explosionTint, clamp(explosion * 1.5, 0.0, 1.0));
    if (alpha < 0.02) {
      discard;
    }
    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
  }
`;

function drawNebula(ctx, width, height, color, intensity) {
  if (intensity <= 0) {
    return;
  }
  const blobCount = Math.max(1, Math.floor(intensity * 4));
  for (let i = 0; i < blobCount; i += 1) {
    const radius = (width + height) * (0.08 + Math.random() * 0.12);
    const x = Math.random() * width;
    const y = Math.random() * height;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `${color}44`);
    gradient.addColorStop(1, '#00000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

function createSkyboxTexture(config) {
  const width = config.textureWidth ?? 1024;
  const height = config.textureHeight ?? 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, config.gradientTop);
  gradient.addColorStop(1, config.gradientBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawNebula(ctx, width, height, config.accentColor, config.nebulaIntensity);

  const starCount = config.starCount ?? 600;
  for (let i = 0; i < starCount; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 1.5 + 0.2;
    const twinkle = Math.random();
    const gradientStar = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
    const brightness = Math.random() * 0.6 + 0.4;
    const color = twinkle > 0.5 ? config.twinkleColor : '#ffffff';
    gradientStar.addColorStop(0, `${color}${Math.floor(255 * brightness).toString(16).padStart(2, '0')}`);
    gradientStar.addColorStop(1, '#00000000');
    ctx.fillStyle = gradientStar;
    ctx.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6);
  }

  return new THREE.CanvasTexture(canvas);
}

function createSkybox(scene) {
  const config = {
    radius: 1200,
    starCount: 600,
    gradientTop: '#0b1024',
    gradientBottom: '#040611',
    accentColor: '#243b86',
    twinkleColor: '#9bcaff',
    nebulaIntensity: 1.5,
    textureWidth: 1024,
    textureHeight: 512,
    ...(backgroundConfig.skybox ?? {})
  };
  const texture = createSkyboxTexture(config);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.SphereGeometry(config.radius, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false
  });
  const skybox = new THREE.Mesh(geometry, material);
  skybox.name = 'BackgroundSkybox';
  scene.add(skybox);
  return { skybox, texture };
}

export function createBackgroundNebula(scene) {
  const starsGeometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const sizes = [];
  const timeOffsets = [];
  const color = new THREE.Color();

  for (let i = 0; i < backgroundConfig.starCount; i += 1) {
    const r = backgroundConfig.radius;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(1));
    const radius = Math.random() * r;
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const y = Math.sin(phi) * Math.sin(theta) * radius;
    const z = Math.cos(phi) * radius;
    positions.push(x, y, z);
    color.setHSL(
      backgroundConfig.color.hueBase + Math.random() * backgroundConfig.color.hueVariance,
      backgroundConfig.color.saturation,
      backgroundConfig.color.lightnessBase + Math.random() * backgroundConfig.color.lightnessVariance
    );
    colors.push(color.r, color.g, color.b);
    const baseSize = backgroundConfig.material.size;
    const variance = backgroundConfig.material.sizeVariance ?? 0;
    const value = baseSize + THREE.MathUtils.randFloatSpread(variance);
    sizes.push(Math.max(1, value));
    timeOffsets.push(Math.random());
  }

  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  starsGeometry.setAttribute('timeOffset', new THREE.Float32BufferAttribute(timeOffsets, 1));

  const starsMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulseSpeed: { value: backgroundConfig.material.pulseSpeed },
      uBaseOpacity: { value: backgroundConfig.material.opacity },
      uHaloIntensity: { value: backgroundConfig.material.haloIntensity }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const stars = new THREE.Points(starsGeometry, starsMaterial);
  stars.frustumCulled = false;
  stars.renderOrder = -10;
  scene.add(stars);

  const { skybox, texture } = createSkybox(scene);

  return {
    stars,
    skybox,
    update(time) {
      starsMaterial.uniforms.uTime.value = time;
    },
    dispose() {
      scene.remove(stars);
      scene.remove(skybox);
      starsGeometry.dispose();
      starsMaterial.dispose();
      skybox.geometry.dispose();
      skybox.material.dispose();
      texture.dispose();
    }
  };
}
