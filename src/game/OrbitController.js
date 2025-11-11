import * as THREE from 'three';
import { ORBIT_RADIUS_MIN, ORBIT_RADIUS_MAX, SYSTEM_SPEED } from './constants.js';
import { createFollowTarget } from './targets.js';

const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const orbitTarget = new THREE.Vector3();

export class OrbitController {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.group = null;
  }

  enter(planetData, ship, camera) {
    if (!planetData) return;
    this.state.level = 'transition';
    this.group = new THREE.Group();
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(18, 64, 64),
      new THREE.MeshStandardMaterial({
        color: planetData.mesh.material.color.clone(),
        roughness: 1,
        metalness: 0.05
      })
    );
    surface.receiveShadow = true;
    this.group.add(surface);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(18.5, 48, 48),
      new THREE.MeshBasicMaterial({
        color: planetData.mesh.material.color.clone().offsetHSL(0, -0.1, 0.2),
        transparent: true,
        opacity: 0.25,
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
    camera.position.set(0, 0, 48);
    camera.lookAt(0, 0, 0);
  }

  exit(ship, planetData) {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group = null;
    if (planetData) {
      ship.setTarget(createFollowTarget(planetData.mesh, planetData.radius + 3));
      ship.setSpeed(SYSTEM_SPEED);
    }
    this.state.level = 'system';
    this.state.orbitZoomBuffer = 0;
    this.state.resetZoom('system');
  }

  handleZoom(direction, magnitude) {
    const orbit = this.state.orbitMotion;
    if (direction > 0) {
      orbit.radius = THREE.MathUtils.clamp(
        orbit.radius - THREE.MathUtils.lerp(1.2, 3.6, magnitude),
        ORBIT_RADIUS_MIN,
        ORBIT_RADIUS_MAX
      );
      this.state.orbitZoomBuffer = 0;
    } else {
      const previousRadius = orbit.radius;
      orbit.radius = THREE.MathUtils.clamp(
        orbit.radius + THREE.MathUtils.lerp(1.2, 3.6, magnitude),
        ORBIT_RADIUS_MIN,
        ORBIT_RADIUS_MAX
      );
      if (
        orbit.radius >= ORBIT_RADIUS_MAX &&
        previousRadius >= ORBIT_RADIUS_MAX - 0.5
      ) {
        this.state.orbitZoomBuffer = Math.min(
          1,
          this.state.orbitZoomBuffer + 0.25 + magnitude * 0.35
        );
        if (this.state.orbitZoomBuffer >= 1) {
          this.state.orbitZoomBuffer = 0;
          return true;
        }
      } else {
        this.state.orbitZoomBuffer = Math.max(0, this.state.orbitZoomBuffer - 0.2);
      }
    }
    return false;
  }

  update(delta, ship, camera) {
    if (!this.group) return;
    this.updateShipPosition(ship, delta);
    const orbit = this.state.orbitMotion;
    const radiusT = THREE.MathUtils.clamp(
      (orbit.radius - ORBIT_RADIUS_MIN) /
        Math.max(ORBIT_RADIUS_MAX - ORBIT_RADIUS_MIN, 1),
      0,
      1
    );
    const offsetY = THREE.MathUtils.lerp(6, 14, radiusT);
    const offsetZ = THREE.MathUtils.lerp(10, 26, radiusT);
    cameraOffset.set(0, offsetY, offsetZ);
    cameraTarget.copy(ship.position).add(cameraOffset);
    const followAlpha = THREE.MathUtils.clamp(delta * 5, 0.05, 0.2);
    camera.position.lerp(cameraTarget, followAlpha);
    camera.lookAt(ship.position);
  }

  updateShipPosition(ship, delta = 0) {
    const orbit = this.state.orbitMotion;
    orbit.radius = THREE.MathUtils.clamp(orbit.radius, ORBIT_RADIUS_MIN, ORBIT_RADIUS_MAX);
    if (this.state.pressedKeys.has('KeyW')) {
      orbit.theta -= delta * 0.6;
    }
    if (this.state.pressedKeys.has('KeyS')) {
      orbit.theta += delta * 0.6;
    }
    if (this.state.pressedKeys.has('KeyA')) {
      orbit.phi -= delta * 0.7;
    }
    if (this.state.pressedKeys.has('KeyD')) {
      orbit.phi += delta * 0.7;
    }

    orbit.theta = THREE.MathUtils.clamp(orbit.theta, 0.2, Math.PI - 0.2);
    orbit.phi = (orbit.phi + Math.PI * 2) % (Math.PI * 2);

    orbitTarget.setFromSphericalCoords(orbit.radius, orbit.theta, orbit.phi);
    ship.position.copy(orbitTarget);
  }
}
