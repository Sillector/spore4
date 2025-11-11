import * as THREE from 'three';

export function createBackgroundNebula(scene) {
  const starsGeometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const color = new THREE.Color();

  for (let i = 0; i < 2000; i += 1) {
    const r = 600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(1));
    const radius = Math.random() * r;
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const y = Math.sin(phi) * Math.sin(theta) * radius;
    const z = Math.cos(phi) * radius;
    positions.push(x, y, z);
    color.setHSL(0.55 + Math.random() * 0.08, 0.55, 0.26 + Math.random() * 0.12);
    colors.push(color.r, color.g, color.b);
  }

  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const starsMaterial = new THREE.PointsMaterial({
    size: 0.9,
    vertexColors: true,
    opacity: 0.38,
    transparent: true
  });

  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);
}
