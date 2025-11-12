import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createStarMaterial } from './starShader.js';

const starsConfig = getConfig('stars');

function pickColorHex(palette, random) {
  if (Array.isArray(palette) && palette.length > 0) {
    const idx = Math.floor((random.next?.() ?? Math.random()) * palette.length);
    return palette[idx];
  }
  return '#ffffff';
}

export function createStarMesh(kind, random, options = {}) {
  const radiusBase = random.float(starsConfig.radiusMin, starsConfig.radiusMax);
  const kindScale = (starsConfig.scale && (kind in starsConfig.scale))
    ? starsConfig.scale[kind]
    : 1;
  const radius = radiusBase * kindScale;

  const palette = starsConfig.color?.palette;
  const baseHex = options.baseHex || pickColorHex(palette, random);
  const color = options.baseColor instanceof THREE.Color
    ? options.baseColor.clone()
    : new THREE.Color(baseHex || '#ffffff');

  const mat = createStarMaterial({
    color,
    intensity: starsConfig.brightness?.intensity ?? 1,
    glow: starsConfig.brightness?.glow ?? 1,
    scale: starsConfig.shader?.scale ?? 5,
    speed: starsConfig.shader?.speed ?? 1
  });
  const segments = kind === 'system' ? 32 : 20;
  const geom = new THREE.SphereGeometry(radius, segments, segments);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.radius = radius;
  mesh.userData.color = color.clone();
  mesh.userData.kind = kind;
  return mesh;
}
