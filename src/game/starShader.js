import * as THREE from 'three';

export function createStarMaterial({ color = new THREE.Color('#ffffff'), intensity = 1, glow = 1, scale = 5, speed = 1 } = {}) {
  const uniforms = {
    uColor: { value: color.clone() },
    uIntensity: { value: intensity },
    uGlow: { value: glow },
    uScale: { value: scale },
    uTime: { value: 0 },
    uSpeed: { value: speed }
  };
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    void main() {
      vUv = uv;
      vec3 normalW = normalize(normalMatrix * normal);
      vNormalW = normalW;
      vec3 viewPos = (modelViewMatrix * vec4(position, 1.0)).xyz;
      vViewDir = normalize(-viewPos);
      gl_Position = projectionMatrix * vec4(viewPos, 1.0);
    }
  `;
  const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uGlow;
    uniform float uScale;
    uniform float uTime;
    uniform float uSpeed;

    // более явный каустический узор на основе нормали сферы
    float caustic(vec2 p) {
      float t = uTime * uSpeed;
      float s = uScale;
      float a = sin(p.x * s + 0.7 * sin(p.y * s * 0.8 + t));
      float b = cos(p.y * s * 1.1 + 0.6 * cos(p.x * s * 0.6 - t*0.9));
      float c = sin((p.x + p.y) * s * 0.5 + t * 0.7);
      float v = (a + b + c) / 3.0; // [-1..1]
      v = 0.5 + 0.5 * v; // [0..1]
      // поднять контраст для читаемости
      v = smoothstep(0.3, 0.95, v);
      return v;
    }

    void main() {
      // Френель — свечение по краям
      float NdotV = clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0);
      float fresnel = pow(1.0 - NdotV, 3.0);

      // Используем нормаль как координаты узора, чтобы избежать растяжения UV
      vec2 p = normalize(vNormalW).xy;
      float pat = caustic(p);

      // Сильнее поджечь центр и края
      float emiss = uIntensity * mix(0.9, 1.8, pat) + uGlow * fresnel * 2.0;
      vec3 col = uColor * emiss;
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    blending: THREE.NormalBlending,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: true,
    dithering: true
  });
  material.userData.isStarShader = true;
  material.userData.speed = speed;
  return material;
}

export function tickStarMaterial(material, delta) {
  if (!material || !material.userData?.isStarShader) return;
  material.uniforms.uTime.value += delta;
}
