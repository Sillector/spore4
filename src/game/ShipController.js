import * as THREE from 'three';
import { getConfig } from '../config/store.js';
import { resolveTargetPosition } from './targets.js';

const shipConfig = getConfig('ship');

const tempDirection = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const followSource = new THREE.Vector3();

export class ShipController {
  constructor(scene) {
    this.scene = scene;
    this.ship = this.createShip();
    this.scene.add(this.ship);
    this.target = null;
    this.speed = 0;
  }

  get mesh() {
    return this.ship;
  }

  get position() {
    return this.ship.position;
  }

  setSpeed(value) {
    this.speed = value;
  }

  setTarget(target) {
    this.target = target;
  }

  clearTarget() {
    this.target = null;
  }

  snapToTarget() {
    if (!this.target) return;
    if (this.target.type === 'path') {
      if (this.target.points.length > 0) {
        this.ship.position.copy(this.target.points[0]);
      }
      return;
    }
    const targetPosition = resolveTargetPosition(this.target);
    if (targetPosition) {
      this.ship.position.copy(targetPosition);
    }
  }

  update(delta) {
    if (!this.target) return;
    if (this.target.type === 'path') {
      this.updatePathTarget(delta);
      return;
    }

    const targetPosition = resolveTargetPosition(this.target);
    if (!targetPosition) {
      this.target = null;
      return;
    }

    const isFollow = this.target.type === 'follow';
    if (isFollow) {
      const followAlpha = THREE.MathUtils.clamp(
        delta * shipConfig.movement.follow.rate,
        shipConfig.movement.follow.min,
        shipConfig.movement.follow.max
      );
      this.ship.position.lerp(targetPosition, followAlpha);
    } else {
      tempDirection.copy(targetPosition).sub(this.ship.position);
      const distance = tempDirection.length();
      const moveSpeed = this.speed * delta;
      if (distance > shipConfig.movement.arrivalThreshold) {
        tempDirection.normalize();
        this.ship.position.addScaledVector(tempDirection, Math.min(moveSpeed, distance));
      } else {
        this.ship.position.copy(targetPosition);
        this.target = null;
      }
    }

    if (isFollow && this.target.mesh) {
      this.target.mesh.getWorldPosition(followSource);
      lookTarget.copy(followSource);
      this.ship.lookAt(lookTarget);
    } else {
      tempDirection.copy(targetPosition).sub(this.ship.position);
      if (tempDirection.lengthSq() > 1e-5) {
        lookTarget.copy(this.ship.position).add(tempDirection.normalize());
        this.ship.lookAt(lookTarget);
      }
    }
  }

  updatePathTarget(delta) {
    if (!this.target || this.target.type !== 'path') return;
    if (!this.target.points || this.target.points.length === 0) {
      this.target = this.target.finalTarget || null;
      return;
    }

    const index = Math.min(this.target.currentIndex ?? 0, this.target.points.length - 1);
    const waypoint = this.target.points[index];
    tempDirection.copy(waypoint).sub(this.ship.position);
    const distance = tempDirection.length();
    const moveSpeed = this.speed * delta;
    if (distance > shipConfig.movement.arrivalThreshold) {
      tempDirection.normalize();
      this.ship.position.addScaledVector(tempDirection, Math.min(moveSpeed, distance));
    } else {
      this.ship.position.copy(waypoint);
      this.target.currentIndex = index + 1;
      if (this.target.currentIndex >= this.target.points.length) {
        const finalTarget = this.target.finalTarget || null;
        this.target = finalTarget;
        if (finalTarget) {
          this.update(delta);
        }
        return;
      }
    }

    if (tempDirection.lengthSq() > 1e-5) {
      lookTarget.copy(this.ship.position).add(tempDirection.normalize());
      this.ship.lookAt(lookTarget);
    }
  }

  dispose() {
    this.scene.remove(this.ship);
    this.ship.traverse?.((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (child.material?.dispose) {
          child.material.dispose();
        }
      }
    });
  }

  createShip() {
    const geometry = new THREE.ConeGeometry(
      shipConfig.geometry.radius,
      shipConfig.geometry.height,
      shipConfig.geometry.radialSegments
    );
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(shipConfig.material.color),
      roughness: shipConfig.material.roughness,
      metalness: shipConfig.material.metalness,
      emissive: new THREE.Color(shipConfig.material.emissive),
      emissiveIntensity: shipConfig.material.emissiveIntensity
    });
    const ship = new THREE.Mesh(geometry, material);
    ship.rotateX((shipConfig.rotation.x * Math.PI) / 180);
    ship.castShadow = true;

    const trailGeometry = new THREE.CylinderGeometry(
      shipConfig.trail.radiusTop,
      shipConfig.trail.radiusBottom,
      shipConfig.trail.height,
      shipConfig.trail.radialSegments,
      1,
      shipConfig.trail.openEnded
    );
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(shipConfig.trail.color),
      transparent: true,
      opacity: shipConfig.trail.opacity,
      side: THREE.DoubleSide
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.rotateX((shipConfig.rotation.x * Math.PI) / 180);
    trail.position.z = shipConfig.trail.offsetZ;
    ship.add(trail);

    return ship;
  }
}
