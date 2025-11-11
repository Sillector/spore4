import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { createFollowTarget } from './targets.js';

const orbitConfig = getConfig('orbit');
const shipConfig = getConfig('ship');
const systemConfig = getConfig('system');

const cameraOffset = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const orbitTarget = new THREE.Vector3();

export class OrbitController {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.config = orbitConfig;
    this.group = null;
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
    this.group.add(surface);

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
    camera.position.set(
      this.config.camera.entryPosition.x,
      this.config.camera.entryPosition.y,
      this.config.camera.entryPosition.z
    );
    camera.lookAt(0, 0, 0);
  }

  exit(ship, planetData) {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group = null;
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
    const offsetY = THREE.MathUtils.lerp(
      this.config.camera.offsetY.min,
      this.config.camera.offsetY.max,
      radiusT
    );
    const offsetZ = THREE.MathUtils.lerp(
      this.config.camera.offsetZ.min,
      this.config.camera.offsetZ.max,
      radiusT
    );
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

    orbit.theta = THREE.MathUtils.clamp(
      orbit.theta,
      this.config.controls.thetaClamp,
      Math.PI - this.config.controls.thetaClamp
    );
    orbit.phi = (orbit.phi + Math.PI * 2) % (Math.PI * 2);

    orbitTarget.setFromSphericalCoords(orbit.radius, orbit.theta, orbit.phi);
    ship.position.copy(orbitTarget);
  }
}
