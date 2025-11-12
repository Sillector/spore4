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
uniform float pulseSpeed;
uniform float noiseScale;
uniform vec3 noiseOffset;
uniform float glowStrength;
uniform float highlight;
uniform float causticStrength;
uniform vec2 causticOffset;
uniform float causticRotation;
uniform float causticSpeed;
uniform float causticScale;
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

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float causticPattern(vec2 uv, float t, vec2 offset, float rotation, float speed, float scale) {
  float time = t * speed;
  vec2 p = uv * scale + offset;
  p += vec2(time * 0.08, time * 0.05);
  vec2 q = rotate2d(rotation) * p;
  vec2 r = rotate2d(rotation * 0.62 + 0.8) * p;
  float waveA = sin(q.x * 5.0 + q.y * 3.0 + time * 0.6);
  float waveB = sin(r.x * 6.5 - r.y * 3.5 + time * 0.9);
  float waveC = sin((p.x + p.y) * 6.0 + time * 1.5);
  float combined = waveA + waveB * 0.75 + waveC * 0.6;
  combined = abs(combined);
  combined = pow(combined, 1.4);
  return clamp(combined, 0.0, 1.0);
}

void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(viewDirection, normalize(vNormal)), 0.0), 3.2);
  float distanceFromCenter = length(vUv - vec2(0.5));
  float pulsation = sin(time * pulseSpeed + distanceFromCenter * 6.2831 * pulseScale);
  float pulse = 0.5 + 0.5 * pulsation;
  float turbulence = fbm((vWorldPosition + noiseOffset) * (0.35 + noiseScale * 0.15) + time * 0.25);
  float shockwave = smoothstep(0.95, 0.15, distanceFromCenter + pulse * 0.28 - (turbulence - 0.5) * 0.2);
  float core = smoothstep(0.6, 0.05, distanceFromCenter);
  float aura = smoothstep(1.25, 0.25, distanceFromCenter + fresnel * 0.6 - pulse * 0.1);
  float highlightBoost = mix(1.0, 1.6, highlight);
  float caustics =
    causticPattern(vUv - vec2(0.5), time, causticOffset, causticRotation, causticSpeed, causticScale) *
    causticStrength;
  float causticGlow = caustics * (0.35 + pulse * 0.3);
  float energy = core * (1.1 + pulse * 0.6) + shockwave * (0.6 + pulse * 0.4);
  vec3 color = baseColor * (energy + causticGlow * 0.8) * highlightBoost;
  color += glowColor * (aura * glowStrength * (0.8 + pulse * 0.5 + causticGlow * 0.4));
  color += glowColor * fresnel * (0.5 + pulse * 0.5 + causticGlow * 0.5) * glowStrength * highlightBoost;
  float alpha = clamp(core + aura * 0.8 + fresnel * 0.65 + causticGlow * 0.4, 0.0, 1.0);
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
  timeScale = 1,
  pulseScale = 1,
  pulseSpeed = 3.2,
  noiseScale = 1,
  noiseOffset = new THREE.Vector3(),
  causticStrength = 1,
  causticOffset = new THREE.Vector2(),
  causticRotation = 0,
  causticSpeed = 1,
  causticScale = 3.5
}) {
  const baseColor = color.clone();
  const glowColor = color.clone().lerp(new THREE.Color(0xffffff), 0.35);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: baseColor },
      glowColor: { value: glowColor },
      time: { value: timeOffset },
      pulseScale: { value: pulseScale },
      pulseSpeed: { value: pulseSpeed },
      noiseScale: { value: noiseScale },
      noiseOffset: { value: noiseOffset.clone() },
      glowStrength: { value: glowStrength },
      highlight: { value: 0 },
      causticStrength: { value: causticStrength },
      causticOffset: { value: causticOffset.clone() },
      causticRotation: { value: causticRotation },
      causticSpeed: { value: causticSpeed },
      causticScale: { value: causticScale }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  material.userData = {
    currentHighlight: 0,
    targetHighlight: 0,
    timeScale
  };
  return material;
}

export function randomizeStarMaterialOptions(
  random,
  {
    color = new THREE.Color(0xffffff),
    glowStrength = 1,
    pulseScaleRange = [0.7, 1.4],
    pulseSpeedRange = [2.4, 4.2],
    timeScaleRange = [0.65, 1.35],
    noiseScaleRange = [0.6, 1.3],
    noiseOffsetRange = 6,
    causticStrengthRange = [0.6, 1.25],
    causticSpeedRange = [0.7, 1.6],
    causticScaleRange = [2.6, 4.2]
  } = {}
) {
  const lerp = THREE.MathUtils.lerp;
  const timeScale = lerp(timeScaleRange[0], timeScaleRange[1], random.next());
  const pulseScale = lerp(pulseScaleRange[0], pulseScaleRange[1], random.next());
  const pulseSpeed = lerp(pulseSpeedRange[0], pulseSpeedRange[1], random.next());
  const noiseScale = lerp(noiseScaleRange[0], noiseScaleRange[1], random.next());
  const noiseOffset = new THREE.Vector3(
    random.float(-noiseOffsetRange, noiseOffsetRange),
    random.float(-noiseOffsetRange, noiseOffsetRange),
    random.float(-noiseOffsetRange, noiseOffsetRange)
  );
  const causticStrength = lerp(causticStrengthRange[0], causticStrengthRange[1], random.next());
  const causticSpeed = lerp(causticSpeedRange[0], causticSpeedRange[1], random.next());
  const causticScale = lerp(causticScaleRange[0], causticScaleRange[1], random.next());
  const causticRotation = random.float(0, Math.PI * 2);
  const causticRadius = lerp(0.3, 1.1, random.next());
  const causticAngle = random.float(0, Math.PI * 2);
  const causticOffset = new THREE.Vector2(
    Math.cos(causticAngle) * causticRadius,
    Math.sin(causticAngle) * causticRadius
  );

  return {
    color,
    glowStrength,
    timeOffset: random.float(0, Math.PI * 2),
    timeScale,
    pulseScale,
    pulseSpeed,
    noiseScale,
    noiseOffset,
    causticStrength,
    causticOffset,
    causticRotation,
    causticSpeed,
    causticScale
  };
}
