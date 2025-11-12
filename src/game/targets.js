import * as THREE from 'three';

const tempTarget = new THREE.Vector3();
const tempDirection = new THREE.Vector3();

export function createPointTarget(position) {
  return { type: 'point', position: position.clone() };
}

export function createFollowTarget(mesh, altitude = 0, direction = null) {
  return {
    type: 'follow',
    mesh,
    altitude,
    direction: direction ? direction.clone() : null
  };
}

export function createPathTarget(points, finalTarget = null) {
  return {
    type: 'path',
    points: points.map((point) => point.clone()),
    finalTarget,
    currentIndex: 0
  };
}

export function resolveTargetPosition(target) {
  if (!target) return null;
  if (target.type === 'point') {
    tempTarget.copy(target.position);
    return tempTarget;
  }
  if (target.type === 'follow' && target.mesh) {
    target.mesh.getWorldPosition(tempTarget);
    if (target.altitude !== 0 || target.direction) {
      if (target.direction && target.direction.lengthSq() > 1e-6) {
        tempDirection.copy(target.direction).normalize();
      } else {
        tempDirection.copy(tempTarget);
        if (tempDirection.lengthSq() > 1e-6) {
          tempDirection.normalize();
        } else {
          tempDirection.set(0, 0, 1);
        }
      }
      if (target.altitude !== 0) {
        tempTarget.addScaledVector(tempDirection, target.altitude);
      } else {
        tempTarget.add(tempDirection);
      }
    }
    return tempTarget;
  }
  return null;
}
