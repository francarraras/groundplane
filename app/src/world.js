import * as THREE from "three";

const TAU = Math.PI * 2;
const DEFAULT_COLOR = "#39d9c2";
const DEFAULT_WEIGHT = 0.4;
const MIN_WEIGHT = 0.2;
const TERRAIN_SIZE = 34;
const TERRAIN_HALF = TERRAIN_SIZE / 2;
const TERRAIN_Y = -1.22;
const MAX_TARGET_RADIUS = 10.6;
const CAMERA_NEAR_DISTANCE = 6.2;
const CAMERA_FAR_DISTANCE = 19.5;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LABEL_EMIT_INTERVAL_MS = 90;

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shortestAngleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function labelFrom(region, id) {
  if (region?.title) return region.title;
  if (region?.label) return region.label;
  if (region?.name) return region.name;
  return String(id)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function terrainType(region) {
  if (region?.terrainType) return region.terrainType;
  if (region?.type === "district") return "district";
  if (region?.type === "routine") return "cadence";
  if (region?.type === "task") return "signal";
  if (region?.type === "decision") return "constraint";
  if (region?.type === "memory_claim") return "memory";
  if (region?.type === "review") return "approval";
  return "terrain";
}

function normalizeColor(color) {
  return typeof color === "string" && color.startsWith("#") ? color : DEFAULT_COLOR;
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  material?.dispose?.();
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    disposeMaterial(child.material);
  });
}

function clampTarget(target) {
  target.y = 0;
  const distance = Math.hypot(target.x, target.z);
  if (distance <= MAX_TARGET_RADIUS) return target;
  const scale = MAX_TARGET_RADIUS / distance;
  target.x *= scale;
  target.z *= scale;
  return target;
}

function stableNoise(x, z) {
  return (
    Math.sin(x * 0.71 + z * 0.27) * 0.16 +
    Math.sin(x * 0.31 - z * 0.84) * 0.13 +
    Math.cos(Math.hypot(x, z) * 0.52) * 0.12
  );
}

export function terrainHeightAt(x, z, nodes = []) {
  let height = stableNoise(x, z) - 0.18;

  nodes.forEach((node) => {
    const dx = x - node.position.x;
    const dz = z - node.position.z;
    const influence = Math.exp(-(dx * dx + dz * dz) / Math.max(1, node.districtRadius * node.districtRadius));
    height += influence * (0.36 + node.altitude * 0.72);
  });

  return height;
}

export function buildWorldNodes(model) {
  const regions = Array.isArray(model?.regions) ? model.regions : [];
  const graphNodes = Array.isArray(model?.nodes) ? model.nodes : [];
  const worldRegions = regions.length > 0 ? regions : graphNodes;
  // Order-stable placement: sort by id so identical data renders identical
  // positions regardless of upstream array ordering (spatial memory survives
  // graph rebuilds). Byte comparison, not localeCompare, for determinism.
  const ordered = [...worldRegions].sort((a, b) => {
    const left = String(a?.id ?? "");
    const right = String(b?.id ?? "");
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
  const count = Math.max(ordered.length, 1);
  const pins =
    model?.layoutPins && typeof model.layoutPins === "object" && !Array.isArray(model.layoutPins)
      ? model.layoutPins
      : {};
  const pendingIds = new Set(Array.isArray(model?.pendingReviewNodeIds) ? model.pendingReviewNodeIds : []);

  return ordered.map((region, index) => {
    const id = region?.id || `region-${index + 1}`;
    const angle = (index / count) * TAU - Math.PI / 2;
    const orbit = 3.2 + finiteNumber(region?.orbit, 1) * 3.15;
    const weight = Math.max(MIN_WEIGHT, finiteNumber(region?.weight, DEFAULT_WEIGHT));
    const radius = 0.12 + weight * 0.2;
    const altitude = 0.22 + weight * 0.78;
    const districtRadius = 1 + weight * 1.12;
    const pin = pins[id];
    const pinned = Boolean(pin) && Number.isFinite(pin.x) && Number.isFinite(pin.z);
    const pinLimit = TERRAIN_HALF - 2.4;

    return {
      id,
      label: labelFrom(region, id),
      type: terrainType(region),
      sourceType: region?.type || "region",
      color: normalizeColor(region?.color),
      radius,
      altitude,
      districtRadius,
      weight,
      pinned,
      pendingReview: pendingIds.has(id),
      position: pinned
        ? {
            x: clamp(pin.x, -pinLimit, pinLimit),
            y: altitude,
            z: clamp(pin.z, -pinLimit, pinLimit),
          }
        : {
            x: Math.cos(angle) * orbit,
            y: altitude,
            z: Math.sin(angle) * orbit,
          },
    };
  });
}

export function buildWorldLinks(model, worldNodes = buildWorldNodes(model)) {
  const byId = new Map(worldNodes.map((node) => [node.id, node]));
  const relationships = Array.isArray(model?.relationships) ? model.relationships : [];

  return relationships
    .map((relationship) => {
      if (!relationship || typeof relationship !== "object" || Array.isArray(relationship)) return null;
      const from = byId.get(relationship.from);
      const to = byId.get(relationship.to);
      if (!from || !to) return null;
      return {
        id: relationship.id,
        type: relationship.type || "related",
        from,
        to,
        strength: clamp(finiteNumber(relationship.strength, 0.58), 0.18, 1),
        inferred: Boolean(relationship.inferred),
        permissionMode: relationship.permissionMode || relationship.permission_mode || "suggest-only",
      };
    })
    .filter(Boolean);
}

export function reconcileDistrictDrilldownState(state = {}, options = {}) {
  const atlasPosture = state?.atlasPosture || null;
  const districtPulse = state?.districtPulse || { districtId: null, startedAt: 0 };
  const startedAt = finiteNumber(districtPulse.startedAt, 0);

  if (options?.action === "exit") {
    return {
      atlasPosture: null,
      districtPulse: {
        districtId: null,
        startedAt: finiteNumber(options?.now, startedAt),
      },
      postureToRestore: atlasPosture,
    };
  }

  const districtId = districtPulse.districtId || null;
  const visibleDistrictIds = new Set(Array.isArray(options?.visibleDistrictIds) ? options.visibleDistrictIds : []);
  const activeDistrictId = options?.activeDistrictId || null;
  const shouldPreserve = Boolean(districtId && (visibleDistrictIds.has(districtId) || activeDistrictId === districtId));

  if (!shouldPreserve) {
    return {
      atlasPosture: null,
      districtPulse: {
        districtId: null,
        startedAt,
      },
      postureToRestore: null,
    };
  }

  return {
    atlasPosture,
    districtPulse: {
      districtId,
      startedAt,
    },
    postureToRestore: null,
  };
}

function createTerrainGeometry(nodes) {
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 112, 112);
  const positions = geometry.attributes.position;
  const colors = [];
  const baseColor = new THREE.Color(0x172228);
  const gold = new THREE.Color(0xd6a968);
  const vertexColor = new THREE.Color();
  const regionColor = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getY(index);
    const edgeDistance = Math.max(Math.abs(x), Math.abs(z)) / TERRAIN_HALF;
    const edgeFalloff = clamp(1.1 - edgeDistance * 0.42, 0.68, 1);
    const height = terrainHeightAt(x, z, nodes) * edgeFalloff;
    let strongest = 0;
    let strongestColor = null;

    nodes.forEach((node) => {
      const dx = x - node.position.x;
      const dz = z - node.position.z;
      const influence = Math.exp(-(dx * dx + dz * dz) / Math.max(1, node.districtRadius * node.districtRadius * 1.5));
      if (influence > strongest) {
        strongest = influence;
        strongestColor = node.color;
      }
    });

    vertexColor.copy(baseColor);
    if (strongestColor) {
      regionColor.set(strongestColor);
      vertexColor.lerp(regionColor, clamp(strongest * 0.42, 0, 0.42));
    }
    vertexColor.lerp(gold, clamp((height + 0.2) * 0.12, 0, 0.16));

    positions.setZ(index, height);
    colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function terrainWorldY(x, z, nodes) {
  return TERRAIN_Y + terrainHeightAt(x, z, nodes);
}

function createPathGeometry(from, to, nodes) {
  const points = [];
  const steps = 34;

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = THREE.MathUtils.lerp(from.position.x, to.position.x, t);
    const z = THREE.MathUtils.lerp(from.position.z, to.position.z, t);
    const ground = terrainWorldY(x, z, nodes);
    const lift = Math.sin(t * Math.PI) * 0.42;
    points.push(new THREE.Vector3(x, ground + 0.18 + lift, z));
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}

export function createWorldScene(root, model, callbacks = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05080c, 0.065);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.cursor = "grab";
  renderer.domElement.style.touchAction = "none";
  root.replaceChildren(renderer.domElement);

  const ambient = new THREE.AmbientLight(0x7e8b90, 0.72);
  const moonLight = new THREE.DirectionalLight(0xb8d8ff, 2.6);
  moonLight.position.set(-7, 10, 4);
  const goldLight = new THREE.PointLight(0xf0b86d, 8.5, 40);
  goldLight.position.set(2.5, 4.5, -4);
  const tealLight = new THREE.PointLight(0x50ffe3, 5.6, 34);
  tealLight.position.set(-6, 3.8, 5);
  scene.add(ambient, moonLight, goldLight, tealLight);

  const terrainGroup = new THREE.Group();
  const districtGroup = new THREE.Group();
  const nodeGroup = new THREE.Group();
  const pathGroup = new THREE.Group();
  const particleGroup = new THREE.Group();
  scene.add(terrainGroup, districtGroup, pathGroup, particleGroup, nodeGroup);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();

  let animationFrame = 0;
  let disposed = false;
  let hoveredId = null;
  let nodes = [];
  let nodeEntries = [];
  let links = [];
  let focusState = { selectedId: model?.currentFocus?.id || null, hoveredId: null, relationshipIds: [] };
  let rayTargets = [];
  let terrain = null;
  let lastLabelEmitAt = 0;
  const pendingDistrictEntries = new Map();

  const target = new THREE.Vector3(0, 0, 0);
  const desiredTarget = new THREE.Vector3(0, 0, 0);
  let distance = 13.8;
  let desiredDistance = 13.8;
  let polar = 0.82;
  let desiredPolar = 0.82;
  let azimuth = -0.58;
  let desiredAzimuth = -0.58;
  let atlasPosture = null;
  let districtPulse = { districtId: null, startedAt: 0 };
  let activePointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let dragDistance = 0;
  let orbiting = false;

  function snapshotPosture() {
    return {
      target: desiredTarget.clone(),
      distance: desiredDistance,
      polar: desiredPolar,
      azimuth: desiredAzimuth,
    };
  }

  function restorePosture(posture) {
    const nextPosture = posture || {
      target: new THREE.Vector3(0, 0, 0),
      distance: 13.8,
      polar: 0.82,
      azimuth: -0.58,
    };

    desiredTarget.copy(nextPosture.target);
    clampTarget(desiredTarget);
    desiredDistance = clamp(nextPosture.distance, CAMERA_NEAR_DISTANCE, CAMERA_FAR_DISTANCE);
    desiredPolar = clamp(nextPosture.polar, 0.55, 1.18);
    desiredAzimuth = nextPosture.azimuth;
  }

  function focusEntry(entry, distanceOverride = null) {
    if (!entry) return;
    desiredTarget.set(entry.node.position.x, 0, entry.node.position.z);
    clampTarget(desiredTarget);
    desiredDistance = clamp(
      distanceOverride ?? 7.6 + (1 - entry.node.weight) * 1.4,
      CAMERA_NEAR_DISTANCE,
      CAMERA_FAR_DISTANCE,
    );
    desiredPolar = 0.76;
    desiredAzimuth = Math.atan2(entry.node.position.x, entry.node.position.z) - 0.48;
  }

  function snapshotNodeEntry(entry) {
    if (!entry?.node) return null;
    return {
      node: {
        ...entry.node,
        position: { ...entry.node.position },
      },
    };
  }

  function preservePendingDistrictEntry(activeDistrictId) {
    if (!activeDistrictId) {
      pendingDistrictEntries.clear();
      return;
    }

    const entry = nodeEntries.find((candidate) => candidate.node.id === activeDistrictId);
    if (entry) pendingDistrictEntries.set(activeDistrictId, snapshotNodeEntry(entry));
  }

  function updateCamera(immediate = false) {
    if (immediate) {
      target.copy(desiredTarget);
      distance = desiredDistance;
      polar = desiredPolar;
      azimuth = desiredAzimuth;
    } else {
      target.lerp(desiredTarget, 0.095);
      distance += (desiredDistance - distance) * 0.095;
      polar += (desiredPolar - polar) * 0.095;
      azimuth += shortestAngleDelta(azimuth, desiredAzimuth) * 0.095;
    }

    const horizontal = Math.sin(polar) * distance;
    camera.position.set(
      target.x + Math.sin(azimuth) * horizontal,
      target.y + Math.cos(polar) * distance,
      target.z + Math.cos(azimuth) * horizontal,
    );
    camera.lookAt(target.x, target.y - 0.08, target.z);
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || root.clientWidth || 640));
    const height = Math.max(1, Math.floor(rect.height || root.clientHeight || 420));

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    updateCamera(true);
    emitLabels(true);
  }

  function clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      disposeObject(child);
    }
  }

  function createTerrain(nextNodes) {
    const geometry = createTerrainGeometry(nextNodes);
    const material = new THREE.MeshStandardMaterial({
      color: 0x26383a,
      emissive: 0x071719,
      emissiveIntensity: 0.58,
      roughness: 0.92,
      metalness: 0.04,
      vertexColors: true,
      flatShading: true,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = TERRAIN_Y;

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0xb4c7c7,
        transparent: true,
        opacity: 0.14,
      }),
    );
    mesh.add(wire);
    return mesh;
  }

  function createDistrict(node) {
    const color = new THREE.Color(node.color);
    const height = terrainWorldY(node.position.x, node.position.z, nodes);
    const group = new THREE.Group();
    group.position.set(node.position.x, height + 0.035, node.position.z);

    const field = new THREE.Mesh(
      new THREE.CircleGeometry(node.districtRadius * 0.92, 96),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.036 + node.weight * 0.024,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    field.rotation.x = -Math.PI / 2;

    const ridge = new THREE.Mesh(
      new THREE.RingGeometry(node.districtRadius * 0.72, node.districtRadius, 96),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ridge.rotation.x = -Math.PI / 2;

    group.add(field, ridge);

    if (node.pendingReview) {
      const approvalRing = new THREE.Mesh(
        new THREE.RingGeometry(node.districtRadius * 1.08, node.districtRadius * 1.3, 96),
        new THREE.MeshBasicMaterial({
          color: 0xf0b86d,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      approvalRing.rotation.x = -Math.PI / 2;
      approvalRing.position.y = 0.02;
      group.add(approvalRing);
      group.userData.approvalRing = approvalRing;
    }

    return group;
  }

  function createParticles(nextNodes) {
    const vertices = [];
    const colors = [];
    const color = new THREE.Color();

    nextNodes.forEach((node, nodeIndex) => {
      const nodeColor = new THREE.Color(node.color);
      const count = 26 + Math.round(node.weight * 34);
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * TAU + nodeIndex * 0.71;
        const radius = node.districtRadius * (0.25 + ((index * 37) % 100) / 100);
        const x = node.position.x + Math.cos(angle) * radius;
        const z = node.position.z + Math.sin(angle) * radius * 0.78;
        const y = terrainWorldY(x, z, nextNodes) + 0.08 + ((index * 19) % 31) / 220;
        vertices.push(x, y, z);
        color.copy(nodeColor).lerp(new THREE.Color(0xf1e7d2), 0.18);
        colors.push(color.r, color.g, color.b);
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.047,
        transparent: true,
        opacity: 0.72,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
  }

  function createNodeMesh(node, index) {
    const color = new THREE.Color(node.color);
    const baseY = terrainWorldY(node.position.x, node.position.z, nodes) + 0.32 + node.radius * 0.34;

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(node.radius, 32, 18),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.15,
        roughness: 0.28,
        metalness: 0.18,
      }),
    );
    core.position.set(node.position.x, baseY, node.position.z);
    core.userData.nodeId = node.id;
    core.userData.nodeIndex = index;

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(node.radius * 2.45, 32, 18),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.position.copy(core.position);

    nodeGroup.add(halo, core);
    return { node, core, halo, base: core.position.clone() };
  }

  function createPathLine(link) {
    const color = new THREE.Color(link.to.color).lerp(new THREE.Color(0xf0d6aa), link.inferred ? 0.38 : 0.22);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
    });
    const line = new THREE.Line(createPathGeometry(link.from, link.to, nodes), material);
    line.userData.linkId = link.id;
    line.userData.from = link.from.id;
    line.userData.to = link.to.id;
    line.userData.inferred = link.inferred;
    line.userData.baseOpacity = link.inferred ? 0.1 : 0.14;
    return line;
  }

  function rebuild(nextModel) {
    const activeDistrictId = nextModel?.activeDistrictId || null;
    preservePendingDistrictEntry(activeDistrictId);
    nodes = buildWorldNodes(nextModel);
    const nextDrilldownState = reconcileDistrictDrilldownState(
      { atlasPosture, districtPulse },
      {
        visibleDistrictIds: nodes.map((node) => node.id),
        activeDistrictId,
      },
    );
    atlasPosture = nextDrilldownState.atlasPosture;
    districtPulse = nextDrilldownState.districtPulse;

    clearGroup(terrainGroup);
    clearGroup(districtGroup);
    clearGroup(nodeGroup);
    clearGroup(pathGroup);
    clearGroup(particleGroup);

    terrain = createTerrain(nodes);
    terrainGroup.add(terrain);
    nodes.forEach((node) => districtGroup.add(createDistrict(node)));
    nodeEntries = nodes.map(createNodeMesh);
    rayTargets = nodeEntries.map((entry) => entry.core);

    links = buildWorldLinks(nextModel, nodes);
    links.forEach((link) => pathGroup.add(createPathLine(link)));
    updatePathEmphasis();

    particleGroup.add(createParticles(nodes));

    if (hoveredId && !nodes.some((node) => node.id === hoveredId)) {
      hoveredId = null;
      callbacks.onHover?.(null);
    }
    emitLabels(true);
  }

  function currentWorldPosition(id) {
    const entry = nodeEntries.find((candidate) => candidate.node.id === id);
    return entry?.core.position;
  }

  function emitLabels(force = false) {
    if (!callbacks.onLabels || nodes.length === 0) return;
    const now = typeof performance === "undefined" ? Date.now() : performance.now();
    if (!force && now - lastLabelEmitAt < LABEL_EMIT_INTERVAL_MS) return;
    lastLabelEmitAt = now;

    const canvas = renderer.domElement;
    const width = canvas.clientWidth || canvas.width || 1;
    const height = canvas.clientHeight || canvas.height || 1;

    callbacks.onLabels(
      nodes.map((node) => {
        const worldPosition =
          currentWorldPosition(node.id) || new THREE.Vector3(node.position.x, node.position.y, node.position.z);
        const projected = worldPosition.clone().project(camera);
        const cameraDistance = camera.position.distanceTo(worldPosition);
        return {
          ...node,
          distance: cameraDistance,
          focus: desiredTarget.distanceTo(new THREE.Vector3(node.position.x, 0, node.position.z)),
          screen: {
            x: (projected.x * 0.5 + 0.5) * width,
            y: (-projected.y * 0.5 + 0.5) * height,
            visible: projected.z > -1 && projected.z < 1 && cameraDistance < CAMERA_FAR_DISTANCE + 6,
          },
        };
      }),
    );
  }

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  }

  function pick(event) {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(rayTargets, false)[0];
    return hit?.object?.userData?.nodeId || null;
  }

  function glide(dx, dy) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
    const factor = desiredDistance * 0.0048;
    desiredTarget.addScaledVector(right, -dx * factor);
    desiredTarget.addScaledVector(forward, dy * factor);
    clampTarget(desiredTarget);
  }

  function orbit(dx, dy) {
    desiredAzimuth -= dx * 0.0065;
    desiredPolar = clamp(desiredPolar + dy * 0.0036, 0.55, 1.18);
  }

  function onPointerDown(event) {
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    dragDistance = 0;
    orbiting = event.shiftKey || event.altKey || event.button === 1 || event.button === 2;
    renderer.domElement.setPointerCapture?.(event.pointerId);
    renderer.domElement.style.cursor = orbiting ? "grabbing" : "grabbing";
  }

  function onPointerMove(event) {
    if (activePointerId === event.pointerId) {
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      if (orbiting) orbit(dx, dy);
      else glide(dx, dy);
      return;
    }

    const nextHoveredId = pick(event);
    if (nextHoveredId === hoveredId) return;

    hoveredId = nextHoveredId;
    renderer.domElement.style.cursor = hoveredId ? "pointer" : "grab";
    callbacks.onHover?.(hoveredId);
  }

  function onPointerUp(event) {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    renderer.domElement.style.cursor = hoveredId ? "pointer" : "grab";

    if (dragDistance < 8) {
      const selectedId = pick(event);
      if (selectedId) callbacks.onSelect?.(selectedId);
    }
  }

  function onPointerLeave() {
    if (activePointerId !== null) return;
    if (hoveredId) {
      hoveredId = null;
      callbacks.onHover?.(null);
    }
    renderer.domElement.style.cursor = "grab";
  }

  function onWheel(event) {
    event.preventDefault();
    desiredDistance = clamp(desiredDistance + event.deltaY * 0.01, CAMERA_NEAR_DISTANCE, CAMERA_FAR_DISTANCE);
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function lineMatchesFocus(line, state) {
    if (state.selectedRelationshipId) return Boolean(state.relationshipIds?.includes(line.userData.linkId));
    if (state.relationshipIds?.includes(line.userData.linkId)) return true;
    const activeId = state.hoveredId || state.selectedId;
    return Boolean(activeId && (line.userData.from === activeId || line.userData.to === activeId));
  }

  function updatePathEmphasis() {
    pathGroup.children.forEach((line) => {
      const active = lineMatchesFocus(line, focusState);
      line.visible = active;
      line.material.opacity = active ? (line.userData.inferred ? 0.38 : 0.58) : line.userData.baseOpacity;
      line.material.needsUpdate = true;
    });
  }

  function animate() {
    if (disposed) return;

    const elapsed = clock.getElapsedTime();
    updateCamera();

    if (terrain) {
      terrain.rotation.z = Math.sin(elapsed * 0.09) * 0.006;
    }

    districtGroup.children.forEach((district, index) => {
      const node = nodes[index];
      const selectedBoost = node?.id === focusState.selectedId || node?.id === districtPulse.districtId ? 0.032 : 0;
      const pulse = 1 + selectedBoost + Math.sin(elapsed * 0.45 + index * 0.7) * 0.018;
      district.scale.setScalar(pulse);
      if (district.userData.approvalRing) {
        district.userData.approvalRing.material.opacity = 0.52 + Math.sin(elapsed * 2.2 + index) * 0.28;
      }
    });

    nodeEntries.forEach((entry, index) => {
      const lift = Math.sin(elapsed * 0.82 + index * 0.75) * 0.055;
      entry.core.position.set(entry.base.x, entry.base.y + lift, entry.base.z);
      entry.halo.position.copy(entry.core.position);
      const haloScale = 1 + Math.sin(elapsed * 1.25 + index) * 0.07;
      entry.halo.scale.setScalar(haloScale);
      if (entry.approvalRing) {
        entry.approvalRing.material.opacity = 0.34 + Math.sin(elapsed * 2.2 + index) * 0.2;
        entry.approvalRing.scale.setScalar(1 + Math.sin(elapsed * 1.6 + index * 0.5) * 0.06);
      }
    });

    emitLabels();
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  }

  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(root);
  window.addEventListener("resize", resize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointercancel", onPointerUp);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
  renderer.domElement.addEventListener("contextmenu", onContextMenu);

  rebuild(model);
  resize();
  animate();

  return {
    update(nextModel) {
      rebuild(nextModel);
      resize();
    },
    setFocusState(nextFocusState = {}) {
      focusState = {
        selectedId: nextFocusState.selectedId || focusState.selectedId,
        hoveredId: nextFocusState.hoveredId || null,
        selectedRelationshipId: nextFocusState.selectedRelationshipId || null,
        relationshipIds: Array.isArray(nextFocusState.relationshipIds) ? nextFocusState.relationshipIds : [],
      };
      updatePathEmphasis();
    },
    focus(regionId) {
      const entry = nodeEntries.find((candidate) => candidate.node.id === regionId);
      focusEntry(entry);
    },
    enterDistrict(districtId) {
      const entry =
        nodeEntries.find((candidate) => candidate.node.id === districtId) || pendingDistrictEntries.get(districtId);
      pendingDistrictEntries.delete(districtId);
      if (!entry) return;
      if (!atlasPosture) atlasPosture = snapshotPosture();
      districtPulse = {
        districtId,
        startedAt: typeof performance === "undefined" ? Date.now() : performance.now(),
      };
      focusEntry(entry, 6.9);
    },
    exitDistrict() {
      const nextDrilldownState = reconcileDistrictDrilldownState(
        { atlasPosture, districtPulse },
        {
          action: "exit",
          now: typeof performance === "undefined" ? Date.now() : performance.now(),
        },
      );
      if (nextDrilldownState.postureToRestore) restorePosture(nextDrilldownState.postureToRestore);
      atlasPosture = nextDrilldownState.atlasPosture;
      districtPulse = nextDrilldownState.districtPulse;
    },
    recenter() {
      desiredTarget.set(0, 0, 0);
      desiredDistance = 13.8;
      desiredPolar = 0.82;
      desiredAzimuth = -0.58;
    },
    zoomBy(delta) {
      desiredDistance = clamp(desiredDistance + delta, CAMERA_NEAR_DISTANCE, CAMERA_FAR_DISTANCE);
    },
    orbitBy(delta) {
      desiredAzimuth += delta;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      clearGroup(terrainGroup);
      clearGroup(districtGroup);
      clearGroup(nodeGroup);
      clearGroup(pathGroup);
      clearGroup(particleGroup);
      renderer.dispose();
      root.replaceChildren();
    },
  };
}
