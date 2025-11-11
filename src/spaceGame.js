import * as THREE from 'three';

const STAR_COUNT = 70;
const PLANETS_PER_SYSTEM = 6;
const GALAXY_RADIUS = 120;
const SHIP_SPEED = 12;
const SYSTEM_SPEED = 9;
const GALAXY_ZOOM_STEP = 0.25;
const SYSTEM_ZOOM_STEP = 0.25;
const ORBIT_RADIUS_MIN = 20;
const ORBIT_RADIUS_MAX = 40;

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const tempTarget = new THREE.Vector3();
const tempDirection = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const orbitTarget = new THREE.Vector3();
const followSource = new THREE.Vector3();

export function createSpaceGame(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 35, 110);

  const ambient = new THREE.AmbientLight(0x6f83ff, 0.35);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(50, 80, 40);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const galaxyGroup = new THREE.Group();
  galaxyGroup.name = 'Galaxy';
  scene.add(galaxyGroup);

  let systemWrapper = null;
  let orbitGroup = null;

  const shipGeometry = new THREE.ConeGeometry(0.7, 2.2, 12);
  const shipMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdd55,
    roughness: 0.3,
    metalness: 0.4,
    emissive: 0x332200,
    emissiveIntensity: 0.6
  });
  const ship = new THREE.Mesh(shipGeometry, shipMaterial);
  ship.rotateX(Math.PI / 2);
  ship.castShadow = true;
  scene.add(ship);

  const trailGeometry = new THREE.CylinderGeometry(0.2, 0.0, 1.6, 8, 1, true);
  const trailMaterial = new THREE.MeshBasicMaterial({
    color: 0x77c6ff,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide
  });
  const shipTrail = new THREE.Mesh(trailGeometry, trailMaterial);
  shipTrail.rotateX(Math.PI / 2);
  shipTrail.position.z = -0.8;
  ship.add(shipTrail);

  const state = {
    level: 'galaxy',
    galaxyStars: [],
    currentStar: null,
    currentSystem: null,
    currentPlanet: null,
    shipTarget: null,
    shipSpeed: SHIP_SPEED,
    orbitMotion: {
      theta: Math.PI / 2,
      phi: 0,
      radius: 22,
      velocityTheta: 0,
      velocityPhi: 0
    },
    pressedKeys: new Set(),
    zoomProgress: {
      galaxy: 0,
      system: 0
    },
    orbitZoomBuffer: 0
  };

  const clock = new THREE.Clock();

  function createPointTarget(position) {
    return { type: 'point', position: position.clone() };
  }

  function createFollowTarget(mesh, altitude = 0) {
    return { type: 'follow', mesh, altitude };
  }

  function resolveTargetPosition(target) {
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

  createBackgroundNebula(scene);
  populateGalaxy(galaxyGroup, state);

  const resizeObserver = new ResizeObserver(() => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  resizeObserver.observe(container);

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyChange);
  window.addEventListener('keyup', onKeyChange);

  function onPointerMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(event) {
    event.preventDefault();
    const intersects = pickIntersectables();
    if (!intersects.length) return;

    const first = intersects[0].object;
    if (state.level === 'galaxy') {
      moveShipToStar(first.userData);
    } else if (state.level === 'system') {
      moveShipToPlanet(first.userData);
    }
  }

  function onWheel(event) {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    if (direction === 0) return;

    if (state.level === 'galaxy') {
      if (direction > 0 && state.currentStar) {
        state.zoomProgress.galaxy = Math.min(
          1,
          state.zoomProgress.galaxy + GALAXY_ZOOM_STEP
        );
        if (state.zoomProgress.galaxy >= 1) {
          state.zoomProgress.galaxy = 0;
          enterSystem(state.currentStar);
        }
      } else if (direction < 0) {
        state.zoomProgress.galaxy = Math.max(
          0,
          state.zoomProgress.galaxy - GALAXY_ZOOM_STEP
        );
      }
    } else if (state.level === 'system') {
      if (direction > 0 && state.currentPlanet) {
        state.zoomProgress.system = Math.min(
          1,
          state.zoomProgress.system + SYSTEM_ZOOM_STEP
        );
        if (state.zoomProgress.system >= 1) {
          state.zoomProgress.system = 0;
          enterOrbit(state.currentPlanet);
        }
      } else if (direction < 0) {
        state.zoomProgress.system = Math.max(
          -1,
          state.zoomProgress.system - SYSTEM_ZOOM_STEP
        );
        if (state.zoomProgress.system <= -1) {
          state.zoomProgress.system = 0;
          returnToGalaxy();
        }
      }
    } else if (state.level === 'orbit') {
      const orbit = state.orbitMotion;
      const magnitude = Math.min(Math.abs(event.deltaY) / 140, 1);
      const radiusStep = THREE.MathUtils.lerp(1.2, 3.6, magnitude);
      if (direction > 0) {
        orbit.radius = THREE.MathUtils.clamp(
          orbit.radius - radiusStep,
          ORBIT_RADIUS_MIN,
          ORBIT_RADIUS_MAX
        );
        state.orbitZoomBuffer = 0;
      } else {
        const previousRadius = orbit.radius;
        orbit.radius = THREE.MathUtils.clamp(
          orbit.radius + radiusStep,
          ORBIT_RADIUS_MIN,
          ORBIT_RADIUS_MAX
        );
        if (
          orbit.radius >= ORBIT_RADIUS_MAX &&
          previousRadius >= ORBIT_RADIUS_MAX - 0.5
        ) {
          state.orbitZoomBuffer = Math.min(
            1,
            state.orbitZoomBuffer + 0.25 + magnitude * 0.35
          );
          if (state.orbitZoomBuffer >= 1) {
            state.orbitZoomBuffer = 0;
            exitOrbit();
          }
        } else {
          state.orbitZoomBuffer = Math.max(0, state.orbitZoomBuffer - 0.2);
        }
      }
    }
  }

  function onKeyChange(event) {
    if (event.type === 'keydown') {
      state.pressedKeys.add(event.code);
    } else {
      state.pressedKeys.delete(event.code);
    }
  }

  function pickIntersectables() {
    raycaster.setFromCamera(pointer, camera);

    if (state.level === 'galaxy') {
      return raycaster.intersectObjects(galaxyGroup.children, false);
    }
    if (state.level === 'system' && systemWrapper) {
      const planetMeshes = state.currentSystem.planets.map((planet) => planet.mesh);
      return raycaster.intersectObjects(planetMeshes, false);
    }
    return [];
  }

  function populateGalaxy(group, store) {
    const temp = new THREE.Vector3();
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const star = createStar();
      const radius = Math.cbrt(Math.random()) * GALAXY_RADIUS;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      temp.setFromSphericalCoords(radius, phi, theta);
      star.position.copy(temp);
      star.userData.position = temp.clone();
      star.userData.systemSeed = Math.random();
      group.add(star);
      store.galaxyStars.push(star.userData);
    }
  }

  function createStar() {
    const color = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.8, 0.6);
    const geometry = new THREE.SphereGeometry(1.4, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color.clone().multiplyScalar(0.6),
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      name: `Система ${Math.floor(Math.random() * 900 + 100)}`,
      color,
      mesh
    };
    mesh.userData.mesh = mesh;
    return mesh;
  }

  function moveShipToStar(starData) {
    state.currentStar = starData;
    state.shipTarget = createFollowTarget(starData.mesh, 6);
    state.shipSpeed = SHIP_SPEED;
    state.zoomProgress.galaxy = 0;
  }

  function moveShipToPlanet(planetData) {
    state.currentPlanet = planetData;
    state.shipTarget = createFollowTarget(planetData.mesh, planetData.radius + 3);
    state.shipSpeed = SYSTEM_SPEED;
    state.zoomProgress.system = 0;
  }

  function enterSystem(starData) {
    state.level = 'transition';
    galaxyGroup.visible = false;

    if (systemWrapper) {
      scene.remove(systemWrapper.group);
    }

    const system = buildSystem(starData);
    systemWrapper = system;
    state.currentSystem = system;
    state.currentPlanet = null;
    scene.add(system.group);

    ship.position.set(0, 0, 35);
    state.shipTarget = createPointTarget(new THREE.Vector3(0, 0, 25));
    state.shipSpeed = SYSTEM_SPEED;

    camera.position.set(0, 20, 55);
    camera.lookAt(0, 0, 0);

    state.zoomProgress.system = 0;
    state.orbitZoomBuffer = 0;
    state.zoomProgress.galaxy = 0;
    state.level = 'system';
  }

  function buildSystem(starData) {
    const group = new THREE.Group();
    const starCore = new THREE.Mesh(
      new THREE.SphereGeometry(4, 32, 32),
      new THREE.MeshStandardMaterial({
        color: starData.color,
        emissive: starData.color.clone().multiplyScalar(1.6),
        emissiveIntensity: 2.5,
        roughness: 0.1
      })
    );
    starCore.castShadow = true;
    starCore.receiveShadow = true;
    group.add(starCore);

    const planets = [];
    let orbitRadius = 12;
    for (let i = 0; i < PLANETS_PER_SYSTEM; i += 1) {
      const radius = THREE.MathUtils.randFloat(1.5, 3.8);
      const hue = (starData.systemSeed + i * 0.13) % 1;
      const color = new THREE.Color().setHSL(hue, 0.6, 0.5);
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.7,
          metalness: 0.1
        })
      );
      const orbitAngle = Math.random() * Math.PI * 2;
      planet.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        THREE.MathUtils.randFloat(-1.5, 1.5),
        Math.sin(orbitAngle) * orbitRadius
      );
      planet.castShadow = true;
      planet.receiveShadow = true;
      planet.userData = {
        name: `Планета ${i + 1}`,
        radius,
        mesh: planet
      };
      group.add(planet);
      planets.push({ ...planet.userData, mesh: planet });
      orbitRadius += THREE.MathUtils.randFloat(6, 11);
    }

    const asteroidBelt = createAsteroidBelt(24, 42, 1600);
    group.add(asteroidBelt);

    return { group, star: starCore, planets };
  }

  function createAsteroidBelt(inner, outer, count) {
    const geometry = new THREE.IcosahedronGeometry(0.35, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 1,
      metalness: 0
    });
    const belt = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const radius = THREE.MathUtils.randFloat(inner, outer);
      const angle = Math.random() * Math.PI * 2;
      const height = THREE.MathUtils.randFloatSpread(2.8);
      dummy.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      dummy.scale.setScalar(THREE.MathUtils.randFloat(0.4, 1.2));
      dummy.updateMatrix();
      belt.setMatrixAt(i, dummy.matrix);
    }
    return belt;
  }

  function enterOrbit(planetData) {
    state.level = 'transition';
    if (!systemWrapper) return;

    orbitGroup = new THREE.Group();
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(18, 64, 64),
      new THREE.MeshStandardMaterial({
        color: planetData.mesh.material.color.clone(),
        roughness: 1,
        metalness: 0.05
      })
    );
    surface.receiveShadow = true;
    orbitGroup.add(surface);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(18.5, 48, 48),
      new THREE.MeshBasicMaterial({
        color: planetData.mesh.material.color.clone().offsetHSL(0, -0.1, 0.2),
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      })
    );
    orbitGroup.add(atmosphere);

    scene.add(orbitGroup);
    systemWrapper.group.visible = false;

    state.level = 'orbit';
    state.zoomProgress.system = 0;
    state.orbitMotion.theta = Math.PI / 2;
    state.orbitMotion.phi = 0;
    state.orbitMotion.radius = THREE.MathUtils.clamp(25, ORBIT_RADIUS_MIN, ORBIT_RADIUS_MAX);
    state.shipTarget = null;
    state.orbitZoomBuffer = 0;
    updateShipOrbitPosition();

    camera.position.set(0, 0, 35);
    camera.lookAt(0, 0, 0);
  }

  function exitOrbit() {
    if (!orbitGroup) return;
    scene.remove(orbitGroup);
    orbitGroup = null;
    if (systemWrapper) {
      systemWrapper.group.visible = true;
    }
    state.level = 'system';
    state.shipTarget = createFollowTarget(
      state.currentPlanet.mesh,
      state.currentPlanet.radius + 3
    );
    state.shipSpeed = SYSTEM_SPEED;
    state.orbitZoomBuffer = 0;
    state.zoomProgress.system = 0;
  }

  function returnToGalaxy() {
    state.level = 'galaxy';
    if (systemWrapper) {
      scene.remove(systemWrapper.group);
      systemWrapper = null;
      state.currentSystem = null;
      state.currentPlanet = null;
    }
    if (orbitGroup) {
      scene.remove(orbitGroup);
      orbitGroup = null;
    }
    galaxyGroup.visible = true;
    camera.position.set(0, 35, 110);
    camera.lookAt(0, 0, 0);
    state.shipTarget = state.currentStar
      ? createFollowTarget(state.currentStar.mesh, 6)
      : createPointTarget(new THREE.Vector3());
    state.shipSpeed = SHIP_SPEED;
    state.zoomProgress.galaxy = 0;
    state.zoomProgress.system = 0;
    state.orbitZoomBuffer = 0;
  }

  function updateShipOrbitPosition(delta = 0) {
    const orbit = state.orbitMotion;
    orbit.radius = THREE.MathUtils.clamp(
      orbit.radius,
      ORBIT_RADIUS_MIN,
      ORBIT_RADIUS_MAX
    );

    if (state.pressedKeys.has('KeyW')) {
      orbit.theta -= delta * 0.6;
    }
    if (state.pressedKeys.has('KeyS')) {
      orbit.theta += delta * 0.6;
    }
    if (state.pressedKeys.has('KeyA')) {
      orbit.phi -= delta * 0.7;
    }
    if (state.pressedKeys.has('KeyD')) {
      orbit.phi += delta * 0.7;
    }

    orbit.theta = THREE.MathUtils.clamp(orbit.theta, 0.2, Math.PI - 0.2);
    orbit.phi = (orbit.phi + Math.PI * 2) % (Math.PI * 2);

    orbitTarget.setFromSphericalCoords(orbit.radius, orbit.theta, orbit.phi);
    ship.position.copy(orbitTarget);

    cameraOffset.set(0, 4, 6);
    cameraTarget.copy(orbitTarget).add(cameraOffset);
    camera.position.lerp(cameraTarget, 0.12);
    camera.lookAt(0, 0, 0);
  }

  function updateGalaxyCamera() {
    const zoom = state.zoomProgress.galaxy;
    const targetY = THREE.MathUtils.lerp(35, 24, zoom);
    const targetZ = THREE.MathUtils.lerp(110, 78, zoom);
    cameraTarget.set(0, targetY, targetZ);
    camera.position.lerp(cameraTarget, 0.08);
    camera.lookAt(ship.position);
  }

  function updateSystemCamera() {
    const zoom = state.zoomProgress.system;
    let offsetY = 12;
    let offsetZ = 35;
    if (zoom >= 0) {
      offsetY = THREE.MathUtils.lerp(12, 6, zoom);
      offsetZ = THREE.MathUtils.lerp(35, 24, zoom);
    } else {
      const amount = -zoom;
      offsetY = THREE.MathUtils.lerp(12, 18, amount);
      offsetZ = THREE.MathUtils.lerp(35, 52, amount);
    }
    cameraOffset.set(0, offsetY, offsetZ);
    cameraTarget.copy(ship.position).add(cameraOffset);
    camera.position.lerp(cameraTarget, 0.08);
    camera.lookAt(ship.position);
  }

  function createBackgroundNebula(rootScene) {
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
      color.setHSL(0.55 + Math.random() * 0.1, 0.6, 0.5 + Math.random() * 0.2);
      colors.push(color.r, color.g, color.b);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const starsMaterial = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      opacity: 0.8,
      transparent: true
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    rootScene.add(stars);
  }

  function animate() {
    const delta = clock.getDelta();

    if (state.shipTarget) {
      const targetPosition = resolveTargetPosition(state.shipTarget);
      if (targetPosition) {
        tempDirection.copy(targetPosition).sub(ship.position);
        const distance = tempDirection.length();
        const moveSpeed = state.shipSpeed * delta;
        const isFollow = state.shipTarget.type === 'follow';
        if (distance > 0.05) {
          tempDirection.normalize();
          ship.position.addScaledVector(tempDirection, Math.min(moveSpeed, distance));
        } else {
          ship.position.copy(targetPosition);
        }

        if (isFollow && state.shipTarget.mesh) {
          state.shipTarget.mesh.getWorldPosition(followSource);
          lookTarget.copy(followSource);
          ship.lookAt(lookTarget);
        } else if (distance > 0.05) {
          lookTarget.copy(ship.position).add(tempDirection);
          ship.lookAt(lookTarget);
        } else {
          state.shipTarget = null;
        }
      } else {
        state.shipTarget = null;
      }
    }

    if (state.level === 'orbit') {
      updateShipOrbitPosition(delta);
    } else if (state.level === 'system') {
      if (state.currentSystem) {
        state.currentSystem.group.rotation.y += delta * 0.05;
      }
      updateSystemCamera();
    } else if (state.level === 'galaxy') {
      galaxyGroup.rotation.y += delta * 0.01;
      updateGalaxyCamera();
    } else if (state.level === 'transition') {
      camera.lookAt(ship.position);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();

  return {
    dispose() {
      resizeObserver.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyChange);
      window.removeEventListener('keyup', onKeyChange);
    }
  };
}
