import * as THREE from 'three';
import { resolveTargetPosition } from './targets.js';

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
    const targetPosition = resolveTargetPosition(this.target);
    if (targetPosition) {
      this.ship.position.copy(targetPosition);
    }
  }

  update(delta) {
    if (!this.target) return;
    const targetPosition = resolveTargetPosition(this.target);
    if (!targetPosition) {
      this.target = null;
      return;
    }

    const isFollow = this.target.type === 'follow';
    if (isFollow) {
      const followAlpha = THREE.MathUtils.clamp(delta * 8, 0.08, 0.55);
      this.ship.position.lerp(targetPosition, followAlpha);
    } else {
      tempDirection.copy(targetPosition).sub(this.ship.position);
      const distance = tempDirection.length();
      const moveSpeed = this.speed * delta;
      if (distance > 0.05) {
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
    const geometry = new THREE.ConeGeometry(0.7, 2.2, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffdd55,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0x332200,
      emissiveIntensity: 0.6
    });
    const ship = new THREE.Mesh(geometry, material);
    ship.rotateX(Math.PI / 2);
    ship.castShadow = true;

    const trailGeometry = new THREE.CylinderGeometry(0.2, 0.0, 1.6, 8, 1, true);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0x77c6ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.rotateX(Math.PI / 2);
    trail.position.z = -0.8;
    ship.add(trail);

    return ship;
  }
}
