import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { getConfig } from '../config/store.js';
import { createFollowTarget } from './targets.js';

const orbitConfig = getConfig('orbit');
const shipConfig = getConfig('ship');
const systemConfig = getConfig('system');

const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const orbitTarget = new THREE.Vector3();
const vertex = new THREE.Vector3();
const normal = new THREE.Vector3();
const featureQuaternion = new THREE.Quaternion();
const featureScale = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 0, 1);
const tempMatrix = new THREE.Matrix4();

function randomInt(random, min, max) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(random.random() * (b - a + 1)) + a;
}

function createSeededRandom(seed) {
  let value = Math.floor(Math.abs(seed % 2147483647));
  if (value === 0) {
    value = 2147483647;
  }
  return {
    random() {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    }
  };
}

function randomOnSphere(random) {
  const u = random.random();
  const v = random.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    sinPhi * Math.cos(theta),
    Math.cos(phi),
    sinPhi * Math.sin(theta)
  );
}

function toSphericalVector(radius, latitude, longitude) {
  const cosLat = Math.cos(latitude);
  return new THREE.Vector3(
    radius * cosLat * Math.cos(longitude),
    radius * Math.sin(latitude),
    radius * cosLat * Math.sin(longitude)
  );
}

export class OrbitController {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.config = orbitConfig;
    this.group = null;
    this.surface = null;
  }

  enter(planetData, ship, camera) {
    if (!planetData) return;
    this.state.level = 'transition';
    this.group = new THREE.Group();
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(
        this.config.surface.radius,
        this.config.surface.widthSegments,
        this.config.surface.heightSegments
      ),
      new THREE.MeshStandardMaterial({
        color: planetData.mesh.material.color.clone(),
        roughness: this.config.surface.material.roughness,
        metalness: this.config.surface.material.metalness
      })
    );
    surface.receiveShadow = true;
    this.surface = surface;
    this.applySurfaceNoise(surface.geometry, planetData);
    this.group.add(surface);

    this.decorateSurface(planetData);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(
        this.config.atmosphere.radius,
        this.config.atmosphere.widthSegments,
        this.config.atmosphere.heightSegments
      ),
      new THREE.MeshBasicMaterial({
        color: planetData.mesh.material.color
          .clone()
          .offsetHSL(0, this.config.atmosphere.saturationOffset, this.config.atmosphere.lightnessOffset),
        transparent: true,
        opacity: this.config.atmosphere.opacity,
        side: THREE.DoubleSide
      })
    );
    this.group.add(atmosphere);

    this.scene.add(this.group);
    this.state.level = 'orbit';
    this.state.resetZoom('system');
    this.state.resetOrbitMotion();
    ship.clearTarget();
    this.updateShipPosition(ship);
    const height = this.config.camera.topDownHeight;
    cameraOffset.set(0, height, 0);
    camera.position.copy(ship.position).add(cameraOffset);
    camera.lookAt(ship.position);
  }

  exit(ship, planetData) {
    if (!this.group) return;
    this.disposeGroup(this.group);
    this.scene.remove(this.group);
    this.group = null;
    this.surface = null;
    if (planetData) {
      ship.setTarget(
        createFollowTarget(
          planetData.mesh,
          planetData.radius + systemConfig.ship.approachOffset
        )
      );
      ship.setSpeed(shipConfig.speeds.system);
    }
    this.state.level = 'system';
    this.state.orbitZoomBuffer = 0;
    this.state.resetZoom('system');
  }

  handleZoom(direction, magnitude) {
    const orbit = this.state.orbitMotion;
    if (direction > 0) {
      orbit.radius = THREE.MathUtils.clamp(
        orbit.radius - THREE.MathUtils.lerp(
          this.config.zoom.step.min,
          this.config.zoom.step.max,
          magnitude
        ),
        this.config.radius.min,
        this.config.radius.max
      );
      this.state.orbitZoomBuffer = 0;
    } else {
      const previousRadius = orbit.radius;
      orbit.radius = THREE.MathUtils.clamp(
        orbit.radius + THREE.MathUtils.lerp(
          this.config.zoom.step.min,
          this.config.zoom.step.max,
          magnitude
        ),
        this.config.radius.min,
        this.config.radius.max
      );
      if (
        orbit.radius >= this.config.radius.max &&
        previousRadius >= this.config.radius.max - this.config.zoom.radiusExitThreshold
      ) {
        this.state.orbitZoomBuffer = Math.min(
          1,
          this.state.orbitZoomBuffer +
            this.config.zoom.bufferIncrement +
            magnitude * this.config.zoom.bufferMagnitudeMultiplier
        );
        if (this.state.orbitZoomBuffer >= 1) {
          this.state.orbitZoomBuffer = 0;
          return true;
        }
      } else {
        this.state.orbitZoomBuffer = Math.max(
          0,
          this.state.orbitZoomBuffer - this.config.zoom.bufferDecrement
        );
      }
    }
    return false;
  }

  update(delta, ship, camera) {
    if (!this.group) return;
    this.updateShipPosition(ship, delta);
    const orbit = this.state.orbitMotion;
    const radiusT = THREE.MathUtils.clamp(
      (orbit.radius - this.config.radius.min) /
        Math.max(this.config.radius.max - this.config.radius.min, 1),
      0,
      1
    );
    const height = THREE.MathUtils.lerp(
      this.config.camera.offsetY.min,
      this.config.camera.offsetY.max,
      radiusT
    );
    cameraOffset.set(0, height, 0);
    cameraTarget.copy(ship.position).add(cameraOffset);
    const followAlpha = THREE.MathUtils.clamp(
      delta * this.config.camera.follow.rate,
      this.config.camera.follow.min,
      this.config.camera.follow.max
    );
    camera.position.lerp(cameraTarget, followAlpha);
    camera.lookAt(ship.position);
  }

  updateShipPosition(ship, delta = 0) {
    const orbit = this.state.orbitMotion;
    orbit.radius = THREE.MathUtils.clamp(
      orbit.radius,
      this.config.radius.min,
      this.config.radius.max
    );
    if (this.state.pressedKeys.has('KeyW')) {
      orbit.theta -= delta * this.config.controls.thetaSpeed;
    }
    if (this.state.pressedKeys.has('KeyS')) {
      orbit.theta += delta * this.config.controls.thetaSpeed;
    }
    if (this.state.pressedKeys.has('KeyA')) {
      orbit.phi -= delta * this.config.controls.phiSpeed;
    }
    if (this.state.pressedKeys.has('KeyD')) {
      orbit.phi += delta * this.config.controls.phiSpeed;
    }

    orbit.phi += delta * this.config.controls.autoPhiSpeed;

    orbit.theta = THREE.MathUtils.clamp(
      orbit.theta,
      this.config.controls.thetaClamp,
      Math.PI - this.config.controls.thetaClamp
    );
    orbit.phi = (orbit.phi + Math.PI * 2) % (Math.PI * 2);

    orbitTarget.setFromSphericalCoords(orbit.radius, orbit.theta, orbit.phi);
    ship.position.copy(orbitTarget);
  }

  disposeGroup(group) {
    group.traverse?.((child) => {
      if (child !== group && child.dispose) {
        child.dispose();
        return;
      }
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material?.dispose?.());
      } else if (child.material?.dispose) {
        child.material.dispose();
      }
    });
  }

  applySurfaceNoise(geometry, planetData) {
    if (!geometry?.attributes?.position) return;
    const noiseConfig = this.config.surface.noise;
    if (!noiseConfig) return;
    const random = createSeededRandom(planetData?.terrainSeed ?? 1);
    const simplex = new SimplexNoise(random);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      vertex.fromBufferAttribute(positions, i);
      normal.copy(vertex).normalize();
      let frequency = noiseConfig.scale;
      let amplitude = noiseConfig.amplitude;
      let displacement = 0;
      for (let octave = 0; octave < noiseConfig.octaves; octave += 1) {
        const value = simplex.noise3d(
          normal.x * frequency,
          normal.y * frequency,
          normal.z * frequency
        );
        displacement += value * amplitude;
        amplitude *= noiseConfig.persistence;
        frequency *= noiseConfig.lacunarity;
      }
      vertex.addScaledVector(normal, displacement);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    if (geometry.attributes.normal) {
      geometry.attributes.normal.needsUpdate = true;
    }
  }

  decorateSurface(planetData) {
    if (!planetData) return;
    const index = planetData.terraformIndex ?? 0;
    if (index === 1) {
      this.createWaterFeatures(planetData);
    } else if (index === 2) {
      this.createForestFeatures(planetData);
    }
  }

  createWaterFeatures(planetData) {
    const random = createSeededRandom((planetData.terrainSeed ?? 1) * 11 + 5);
    const surfaceRadius = this.surface?.geometry?.boundingSphere?.radius ?? this.config.surface.radius;
    const waterColor = new THREE.Color('#3a8cc1');

    const ocean = this.createDiscFeature({
      radius: surfaceRadius * THREE.MathUtils.lerp(0.35, 0.45, random.random()),
      offset: -0.2,
      color: waterColor,
      opacity: 0.8,
      random,
      surfaceRadius
    });
    this.group.add(ocean);

    const lakes = randomInt(random, 2, 4);
    for (let i = 0; i < lakes; i += 1) {
      const lake = this.createDiscFeature({
        radius: surfaceRadius * THREE.MathUtils.lerp(0.08, 0.14, random.random()),
        offset: -0.1,
        color: waterColor,
        opacity: 0.85,
        random,
        surfaceRadius
      });
      this.group.add(lake);
    }

    const rivers = randomInt(random, 2, 3);
    for (let i = 0; i < rivers; i += 1) {
      const river = this.createRiverFeature({
        random,
        surfaceRadius,
        color: waterColor,
        thickness: THREE.MathUtils.lerp(0.25, 0.4, random.random()),
        length: THREE.MathUtils.lerp(Math.PI / 4, Math.PI / 2, random.random())
      });
      if (river) {
        this.group.add(river);
      }
    }
  }

  createForestFeatures(planetData) {
    const random = createSeededRandom((planetData.terrainSeed ?? 1) * 13 + 7);
    const surfaceRadius = this.surface?.geometry?.boundingSphere?.radius ?? this.config.surface.radius;
    const treeCount = 120;
    const treeGeometry = new THREE.ConeGeometry(0.5, 1.6, 6);
    const treeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d8c3c'),
      roughness: 0.8,
      metalness: 0.05
    });
    const trees = new THREE.InstancedMesh(treeGeometry, treeMaterial, treeCount);
    trees.castShadow = true;

    for (let i = 0; i < treeCount; i += 1) {
      const normalVector = randomOnSphere(random);
      const position = normalVector.clone().multiplyScalar(surfaceRadius + 0.6);
      featureQuaternion.setFromUnitVectors(upVector, normalVector);
      const scale = THREE.MathUtils.lerp(0.6, 1.1, random.random());
      featureScale.set(scale, scale, scale);
      tempMatrix.compose(position, featureQuaternion, featureScale);
      trees.setMatrixAt(i, tempMatrix);
    }
    trees.instanceMatrix.needsUpdate = true;
    this.group.add(trees);
  }

  createDiscFeature({ radius, offset, color, opacity, random, surfaceRadius }) {
    const discGeometry = new THREE.CircleGeometry(radius, 32);
    const material = new THREE.MeshStandardMaterial({
      color: color.clone(),
      transparent: true,
      opacity,
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(discGeometry, material);
    mesh.receiveShadow = true;
    const normalVector = randomOnSphere(random);
    featureQuaternion.setFromUnitVectors(upVector, normalVector);
    mesh.quaternion.copy(featureQuaternion);
    mesh.position.copy(normalVector).multiplyScalar(surfaceRadius + offset);
    return mesh;
  }

  createRiverFeature({ random, surfaceRadius, color, thickness, length }) {
    const curvePoints = [];
    const baseLongitude = random.random() * Math.PI * 2;
    const baseLatitude = THREE.MathUtils.lerp(-0.4, 0.4, random.random());
    const segments = 24;
    for (let i = 0; i < segments; i += 1) {
      const t = i / (segments - 1);
      const longitude = baseLongitude + length * (t - 0.5);
      const latitude = baseLatitude + Math.sin(t * Math.PI * 2) * 0.15 * (random.random() - 0.5);
      const point = toSphericalVector(surfaceRadius + 0.2, latitude, longitude);
      curvePoints.push(point);
    }
    if (curvePoints.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const geometry = new THREE.TubeGeometry(curve, 128, thickness * 0.05, 8, false);
    const material = new THREE.MeshStandardMaterial({
      color: color.clone(),
      transparent: true,
      opacity: 0.9,
      roughness: 0.3,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }
}
