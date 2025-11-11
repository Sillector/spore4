import * as THREE from 'three';
import { getConfig } from '../config/store.js';

const backgroundConfig = getConfig('background');

export function createBackgroundNebula(scene) {
  const starsGeometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
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
  }

  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const starsMaterial = new THREE.PointsMaterial({
    size: backgroundConfig.material.size,
    vertexColors: true,
    opacity: backgroundConfig.material.opacity,
    transparent: true
  });

  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);
}
