import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createFollowTarget, createPointTarget } from './targets.js';

const systemConfig = getConfig('system');
const shipConfig = getConfig('ship');

const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();

function createSeededRandom(seed) {
  let value = Math.floor(Math.abs(seed % 2147483647));
  if (value === 0) {
    value = 2147483647;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export class SystemView {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.config = systemConfig;
    this.wrapper = null;
  }

  pick(raycaster) {
    if (!this.state.currentSystem) return [];
    const meshes = this.state.currentSystem.planets.map((planet) => planet.mesh);
    return raycaster.intersectObjects(meshes, false);
  }

  moveShipToPlanet(ship, planetData) {
    this.state.currentPlanet = planetData;
    ship.setTarget(
      createFollowTarget(planetData.mesh, planetData.radius + this.config.ship.approachOffset)
    );
    ship.setSpeed(shipConfig.speeds.system);
    this.state.resetZoom('system');
  }

  handleZoom(direction) {
    if (direction > 0 && this.state.currentPlanet) {
      this.state.zoomProgress.system = Math.min(
        1,
        this.state.zoomProgress.system + this.config.zoom.step
      );
      if (this.state.zoomProgress.system >= 1) {
        this.state.zoomProgress.system = 0;
        return 'enterOrbit';
      }
    } else if (direction < 0) {
      this.state.zoomProgress.system = Math.max(
        -1,
        this.state.zoomProgress.system - this.config.zoom.step
      );
      if (this.state.zoomProgress.system <= -1) {
        this.state.zoomProgress.system = 0;
        return 'returnToGalaxy';
      }
    }
    return null;
  }

  buildSystem(starData) {
    const group = new THREE.Group();
    const starCore = new THREE.Mesh(
      new THREE.SphereGeometry(
        this.config.starCore.radius,
        this.config.starCore.widthSegments,
        this.config.starCore.heightSegments
      ),
      new THREE.MeshStandardMaterial({
        color: starData.color,
        emissive: starData.color
          .clone()
          .multiplyScalar(this.config.starCore.material.emissiveMultiplier),
        emissiveIntensity: this.config.starCore.material.emissiveIntensity,
        roughness: this.config.starCore.material.roughness
      })
    );
    starCore.castShadow = true;
    starCore.receiveShadow = true;
    group.add(starCore);

    const planets = [];
    const random = createSeededRandom(starData.systemSeed);
    let orbitRadius = this.config.planet.orbit.startRadius;
    for (let i = 0; i < this.config.planetsPerSystem; i += 1) {
      const radius = THREE.MathUtils.lerp(
        this.config.planet.radiusRange.min,
        this.config.planet.radiusRange.max,
        random()
      );
      const hue = (starData.systemSeed + i * this.config.planet.color.hueStep) % 1;
      const color = new THREE.Color().setHSL(
        hue,
        this.config.planet.color.saturation,
        this.config.planet.color.lightness
      );
      const planetGeometry = new THREE.SphereGeometry(
        radius,
        this.config.planet.geometrySegments,
        this.config.planet.geometrySegments
      );
      const planetMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: this.config.planet.material.roughness,
        metalness: this.config.planet.material.metalness
      });
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);
      const orbitAngle = random() * Math.PI * 2;
      planet.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        THREE.MathUtils.lerp(
          -this.config.planet.heightRange,
          this.config.planet.heightRange,
          random()
        ),
        Math.sin(orbitAngle) * orbitRadius
      );
      planet.castShadow = true;
      planet.receiveShadow = true;
      planet.userData = {
        name: `${this.config.planet.naming.prefix}${i + 1}`,
        radius,
        mesh: planet,
        terraformIndex: random() > 0.5 ? 2 : 1,
        terrainSeed: starData.systemSeed * 100 + i * 37 + 17
      };
      group.add(planet);
      planets.push({ ...planet.userData, mesh: planet });
      orbitRadius += THREE.MathUtils.lerp(
        this.config.planet.orbit.incrementRange.min,
        this.config.planet.orbit.incrementRange.max,
        random()
      );
    }

    const asteroidBelt = this.createAsteroidBelt(
      this.config.asteroidBelt.innerRadius,
      this.config.asteroidBelt.outerRadius,
      this.config.asteroidBelt.count
    );
    group.add(asteroidBelt);

    this.wrapper = { group, star: starCore, planets };
    this.state.currentSystem = this.wrapper;
    return this.wrapper;
  }

  createAsteroidBelt(inner, outer, count) {
    const geometry = new THREE.IcosahedronGeometry(
      this.config.asteroidBelt.geometryRadius,
      this.config.asteroidBelt.geometryDetail
    );
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.asteroidBelt.materialColor),
      roughness: this.config.asteroidBelt.roughness,
      metalness: this.config.asteroidBelt.metalness
    });
    const belt = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const radius = THREE.MathUtils.randFloat(inner, outer);
      const angle = Math.random() * Math.PI * 2;
      const height = THREE.MathUtils.randFloatSpread(this.config.asteroidBelt.heightSpread);
      dummy.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      dummy.scale.setScalar(
        THREE.MathUtils.randFloat(
          this.config.asteroidBelt.scaleRange.min,
          this.config.asteroidBelt.scaleRange.max
        )
      );
      dummy.updateMatrix();
      belt.setMatrixAt(i, dummy.matrix);
    }
    return belt;
  }

  enter(starData, ship, camera) {
    if (this.wrapper) {
      this.scene.remove(this.wrapper.group);
    }
    const system = this.buildSystem(starData);
    this.scene.add(system.group);
    ship.position.set(
      this.config.ship.entryShipPosition.x,
      this.config.ship.entryShipPosition.y,
      this.config.ship.entryShipPosition.z
    );
    ship.setTarget(
      createPointTarget(new THREE.Vector3(0, 0, this.config.ship.entryTargetZ))
    );
    ship.setSpeed(shipConfig.speeds.system);
    camera.position.set(
      this.config.camera.entryPosition.x,
      this.config.camera.entryPosition.y,
      this.config.camera.entryPosition.z
    );
    camera.lookAt(0, 0, 0);
    this.state.resetZoom();
    this.state.currentStar = starData;
    this.state.currentPlanet = null;
    this.state.level = 'system';
  }

  exit() {
    if (!this.wrapper) return;
    this.scene.remove(this.wrapper.group);
    this.wrapper = null;
    this.state.currentSystem = null;
    this.state.currentPlanet = null;
  }

  update(delta, ship, camera) {
    if (!this.wrapper) return;
    this.wrapper.group.rotation.y += delta * this.config.rotationSpeed;
    const targetZoom = this.state.zoomProgress.system;
    this.state.zoomSmooth.system = THREE.MathUtils.damp(
      this.state.zoomSmooth.system,
      targetZoom,
      this.config.zoom.damping,
      delta
    );
    const zoom = this.state.zoomSmooth.system;
    let offsetY = this.config.camera.baseOffset.y;
    let offsetZ = this.config.camera.baseOffset.z;
    if (zoom >= 0) {
      offsetY = THREE.MathUtils.lerp(
        this.config.camera.baseOffset.y,
        this.config.camera.zoomInOffset.y,
        zoom
      );
      offsetZ = THREE.MathUtils.lerp(
        this.config.camera.baseOffset.z,
        this.config.camera.zoomInOffset.z,
        zoom
      );
    } else {
      const amount = -zoom;
      offsetY = THREE.MathUtils.lerp(
        this.config.camera.baseOffset.y,
        this.config.camera.zoomOutOffset.y,
        amount
      );
      offsetZ = THREE.MathUtils.lerp(
        this.config.camera.baseOffset.z,
        this.config.camera.zoomOutOffset.z,
        amount
      );
    }
    cameraOffset.set(0, offsetY, offsetZ);
    cameraTarget.copy(ship.position).add(cameraOffset);
    const followAlpha = THREE.MathUtils.clamp(
      delta * this.config.camera.follow.rate,
      this.config.camera.follow.min,
      this.config.camera.follow.max
    );
    camera.position.lerp(cameraTarget, followAlpha);
    camera.lookAt(ship.position);
  }

  setVisible(value) {
    if (this.wrapper) {
      this.wrapper.group.visible = value;
    }
  }
}
