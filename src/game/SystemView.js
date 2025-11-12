import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createFollowTarget, createPathTarget, createPointTarget } from './targets.js';
import { createWorldRandom } from './random.js';

const systemConfig = getConfig('system');
const shipConfig = getConfig('ship');

const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const planetWorldPosition = new THREE.Vector3();
const shipWorldPosition = new THREE.Vector3();
const approachDirection = new THREE.Vector3();
const approachPoint = new THREE.Vector3();
const approachOffset = new THREE.Vector3();
const detourShipPoint = new THREE.Vector3();
const detourTargetPoint = new THREE.Vector3();
const obstacleCenter = new THREE.Vector3();
const segmentDirection = new THREE.Vector3();
const segmentToCenter = new THREE.Vector3();

export class SystemView {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.config = systemConfig;
    this.wrapper = null;
    this.hoveredPlanet = null;
  }

  pick(raycaster) {
    if (!this.state.currentSystem) return [];
    const meshes = this.state.currentSystem.planets.map((planet) => planet.mesh);
    return raycaster.intersectObjects(meshes, false);
  }

  moveShipToPlanet(ship, planetData) {
    this.state.currentPlanet = planetData;
    planetData.mesh.getWorldPosition(planetWorldPosition);
    shipWorldPosition.copy(ship.position);
    approachDirection.set(0, 1, 0);
    const altitude = planetData.radius + this.config.ship.approachOffset;
    approachPoint
      .copy(planetWorldPosition)
      .addScaledVector(approachDirection, altitude);
    const detourHeight = this.calculateDetourHeight(
      shipWorldPosition,
      approachPoint,
      planetData
    );
    approachOffset.copy(approachPoint).sub(planetWorldPosition);
    if (approachOffset.lengthSq() < 1e-6) {
      approachOffset.set(0, 0, 1);
    } else {
      approachOffset.normalize();
    }
    if (detourHeight !== null) {
      const detourPoints = [];
      if (shipWorldPosition.y < detourHeight - 1e-3) {
        detourShipPoint.set(shipWorldPosition.x, detourHeight, shipWorldPosition.z);
        detourPoints.push(detourShipPoint.clone());
      }
      if (approachPoint.y < detourHeight - 1e-3) {
        detourTargetPoint.set(approachPoint.x, detourHeight, approachPoint.z);
        detourPoints.push(detourTargetPoint.clone());
      }
      if (detourPoints.length > 0) {
        ship.setTarget(
          createPathTarget(
            detourPoints,
            createFollowTarget(planetData.mesh, altitude, approachOffset)
          )
        );
        ship.setSpeed(shipConfig.speeds.system);
        this.state.resetZoom('system');
        return;
      }
    }
    ship.setTarget(createFollowTarget(planetData.mesh, altitude, approachOffset));
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
    const systemSeed = starData?.systemSeed ?? starData?.id ?? 0;
    const randomGenerator = createWorldRandom('system', systemSeed);
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
    let orbitRadius = this.config.planet.orbit.startRadius;
    const hueBase = randomGenerator.next();
    for (let i = 0; i < this.config.planetsPerSystem; i += 1) {
      const radius = randomGenerator.float(
        this.config.planet.radiusRange.min,
        this.config.planet.radiusRange.max
      );
      const hue = (hueBase + i * this.config.planet.color.hueStep) % 1;
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
      const orbitAngle = randomGenerator.float(0, Math.PI * 2);
      planet.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        randomGenerator.float(
          -this.config.planet.heightRange,
          this.config.planet.heightRange
        ),
        Math.sin(orbitAngle) * orbitRadius
      );
      planet.castShadow = true;
      planet.receiveShadow = true;
      planet.userData = {
        name: `${this.config.planet.naming.prefix}${i + 1}`,
        radius,
        id: i,
        mesh: planet
      };
      const label = this.createPlanetLabel(planet.userData.name, radius);
      if (label) {
        planet.add(label);
        label.position.set(0, radius + 2, 0);
        label.visible = false;
        planet.userData.label = label;
      }
      group.add(planet);
      planets.push({ ...planet.userData, mesh: planet });
      orbitRadius += randomGenerator.float(
        this.config.planet.orbit.incrementRange.min,
        this.config.planet.orbit.incrementRange.max
      );
    }

    const asteroidBelt = this.createAsteroidBelt(
      this.config.asteroidBelt.innerRadius,
      this.config.asteroidBelt.outerRadius,
      this.config.asteroidBelt.count,
      randomGenerator
    );
    group.add(asteroidBelt);

    this.wrapper = { group, star: starCore, planets };
    this.state.currentSystem = this.wrapper;
    return this.wrapper;
  }

  createAsteroidBelt(inner, outer, count, randomGenerator) {
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
      const radius = randomGenerator.float(inner, outer);
      const angle = randomGenerator.float(0, Math.PI * 2);
      const height = randomGenerator.floatSpread(this.config.asteroidBelt.heightSpread);
      dummy.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      dummy.rotation.set(
        randomGenerator.float(0, Math.PI),
        randomGenerator.float(0, Math.PI),
        randomGenerator.float(0, Math.PI)
      );
      dummy.scale.setScalar(
        randomGenerator.float(
          this.config.asteroidBelt.scaleRange.min,
          this.config.asteroidBelt.scaleRange.max
        )
      );
      dummy.updateMatrix();
      belt.setMatrixAt(i, dummy.matrix);
    }
    return belt;
  }

  enter(starData, ship, camera, options = {}) {
    const { autoSelectFirstPlanet = true } = options;
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
    if (system.planets.length > 0 && autoSelectFirstPlanet) {
      this.moveShipToPlanet(ship, system.planets[0]);
    } else {
      ship.setTarget(
        createPointTarget(new THREE.Vector3(0, 0, this.config.ship.entryTargetZ))
      );
      ship.setSpeed(shipConfig.speeds.system);
    }
    camera.position.set(
      this.config.camera.entryPosition.x,
      this.config.camera.entryPosition.y,
      this.config.camera.entryPosition.z
    );
    camera.lookAt(0, 0, 0);
    this.state.resetZoom();
    this.state.currentStar = starData;
    this.state.currentPlanet = null;
    this.hoveredPlanet = null;
    this.state.level = 'system';
  }

  exit() {
    if (!this.wrapper) return;
    if (this.hoveredPlanet?.label) {
      this.hoveredPlanet.label.visible = false;
    }
    this.hoveredPlanet = null;
    this.wrapper.planets.forEach((planet) => {
      if (planet.label) {
        planet.mesh.remove(planet.label);
        if (planet.label.material?.map) {
          planet.label.material.map.dispose();
        }
        if (planet.label.material?.dispose) {
          planet.label.material.dispose();
        }
        planet.label = null;
        if (planet.mesh.userData) {
          planet.mesh.userData.label = null;
        }
      }
    });
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

  setHoveredPlanet(planetData) {
    if (this.hoveredPlanet === planetData) return;
    if (this.hoveredPlanet?.label) {
      this.hoveredPlanet.label.visible = false;
    }
    this.hoveredPlanet = planetData || null;
    if (this.hoveredPlanet?.label) {
      this.hoveredPlanet.label.visible = true;
    }
  }

  createPlanetLabel(name, radius) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    const paddingX = 18;
    context.font = '36px "Roboto", sans-serif';
    context.textBaseline = 'middle';
    const metrics = context.measureText(name);
    const textWidth = metrics.width;
    const boxWidth = Math.min(canvas.width - paddingX * 2, textWidth + paddingX * 2);
    const boxHeight = 56;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = (canvas.height - boxHeight) / 2;
    context.fillStyle = 'rgba(0, 0, 0, 0.65)';
    context.fillRect(boxX, boxY, boxWidth, boxHeight);
    context.fillStyle = '#ffffff';
    context.fillText(name, canvas.width / 2 - textWidth / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    material.depthWrite = false;
    material.depthTest = false;
    const sprite = new THREE.Sprite(material);
    const scaleX = Math.max(radius * 3, 6);
    const scaleY = scaleX * 0.5;
    sprite.scale.set(scaleX, scaleY, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  calculateDetourHeight(shipPosition, targetPosition, targetPlanet) {
    if (!this.wrapper) return null;
    const clearance = this.config.ship.avoidanceClearance ?? 2;
    let requiredHeight = null;
    const starRadius = this.config.starCore.radius;
    if (this.wrapper.star) {
      this.wrapper.star.getWorldPosition(obstacleCenter);
      if (
        this.segmentIntersectsSphere(
          shipPosition,
          targetPosition,
          obstacleCenter,
          starRadius + clearance
        )
      ) {
        const height = obstacleCenter.y + starRadius + clearance;
        if (requiredHeight === null || height > requiredHeight) {
          requiredHeight = height;
        }
      }
    }
    this.wrapper.planets.forEach((planet) => {
      if (planet === targetPlanet) return;
      planet.mesh.getWorldPosition(obstacleCenter);
      const effectiveRadius = planet.radius + clearance;
      if (
        this.segmentIntersectsSphere(
          shipPosition,
          targetPosition,
          obstacleCenter,
          effectiveRadius
        )
      ) {
        const height = obstacleCenter.y + planet.radius + clearance;
        if (requiredHeight === null || height > requiredHeight) {
          requiredHeight = height;
        }
      }
    });
    return requiredHeight;
  }

  segmentIntersectsSphere(start, end, center, radius) {
    segmentDirection.copy(end).sub(start);
    const lengthSq = segmentDirection.lengthSq();
    if (lengthSq < 1e-6) return false;
    segmentToCenter.copy(start).sub(center);
    const a = lengthSq;
    const b = 2 * segmentToCenter.dot(segmentDirection);
    const c = segmentToCenter.lengthSq() - radius * radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      return false;
    }
    const sqrtDiscriminant = Math.sqrt(discriminant);
    const invDenominator = 1 / (2 * a);
    const t1 = (-b - sqrtDiscriminant) * invDenominator;
    const t2 = (-b + sqrtDiscriminant) * invDenominator;
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }
}
