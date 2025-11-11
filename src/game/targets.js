import * as THREE from 'three';

const tempTarget = new THREE.Vector3();
const tempDirection = new THREE.Vector3();

export function createPointTarget(position) {
  return { type: 'point', position: position.clone() };
}

export function createFollowTarget(mesh, altitude = 0) {
  return { type: 'follow', mesh, altitude };
}

export function resolveTargetPosition(target) {
  if (!target) return null;
  if (target.type === 'point') {
    tempTarget.copy(target.position);
    return tempTarget;
  }
  if (target.type === 'follow' && target.mesh) {
    target.mesh.getWorldPosition(tempTarget);
    if (target.altitude !== 0) {
      tempDirection.copy(tempTarget);
      if (tempDirection.lengthSq() > 1e-6) {
        tempDirection.normalize();
        tempTarget.addScaledVector(tempDirection, target.altitude);
      } else {
        tempTarget.z += target.altitude;
      }
    }
    return tempTarget;
  }
  return null;
}
