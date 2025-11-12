import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform vec3 baseColor;
uniform vec3 glowColor;
uniform float time;
uniform float pulseScale;
uniform float noiseScale;
uniform float glowStrength;
uniform float highlight;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 54.53))) * 43758.5453);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 4; i++) {
    value += noise(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(viewDirection, normalize(vNormal)), 0.0), 3.2);
  float distanceFromCenter = length(vUv - vec2(0.5));
  float pulsation = sin(time * 3.2 + distanceFromCenter * 6.2831 * pulseScale);
  float pulse = 0.5 + 0.5 * pulsation;
  float turbulence = fbm(vWorldPosition * (0.35 + noiseScale * 0.15) + time * 0.25);
  float shockwave = smoothstep(0.95, 0.15, distanceFromCenter + pulse * 0.28 - (turbulence - 0.5) * 0.2);
  float core = smoothstep(0.6, 0.05, distanceFromCenter);
  float aura = smoothstep(1.25, 0.25, distanceFromCenter + fresnel * 0.6 - pulse * 0.1);
  float highlightBoost = mix(1.0, 1.6, highlight);
  float energy = core * (1.1 + pulse * 0.6) + shockwave * (0.6 + pulse * 0.4);
  vec3 color = baseColor * energy * highlightBoost;
  color += glowColor * (aura * glowStrength * (0.8 + pulse * 0.5));
  color += glowColor * fresnel * (0.5 + pulse * 0.5) * glowStrength * highlightBoost;
  float alpha = clamp(core + aura * 0.8 + fresnel * 0.65, 0.0, 1.0);
  if (alpha <= 0.01) {
    discard;
  }
  gl_FragColor = vec4(color, alpha);
}
`;

export function createStarMaterial({
  color,
  glowStrength = 1,
  timeOffset = 0,
  pulseScale = 1,
  noiseScale = 1
}) {
  const baseColor = color.clone();
  const glowColor = color.clone().lerp(new THREE.Color(0xffffff), 0.35);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: baseColor },
      glowColor: { value: glowColor },
      time: { value: timeOffset },
      pulseScale: { value: pulseScale },
      noiseScale: { value: noiseScale },
      glowStrength: { value: glowStrength },
      highlight: { value: 0 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  material.userData = {
    currentHighlight: 0,
    targetHighlight: 0
  };
  return material;
}
