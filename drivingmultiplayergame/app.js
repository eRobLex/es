import { config } from 'https://cdn.jsdelivr.net/gh/eRobLex/es@refs/heads/main/drivingmultiplayergame/config.js';

// Initialize multiplayer connection
const room = new WebsimSocket();

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Initialize Cannon.js physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Physics material
const groundMaterial = new CANNON.Material("groundMaterial");
const wheelMaterial = new CANNON.Material("wheelMaterial");
const wheelGroundContactMaterial = new CANNON.ContactMaterial(
  wheelMaterial,
  groundMaterial,
  {
    friction: 0.3,
    restitution: 0,
    contactEquationStiffness: 1000,
  }
);
world.addContactMaterial(wheelGroundContactMaterial);

// Grass texture
function createGrassTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");

  // Draw grass pattern on the canvas
  context.fillStyle = "#228B22"; // ForestGreen color
  context.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 1000; i++) {
    context.fillStyle = `rgba(50,163,21,${Math.random()})`;
    context.fillRect(
      Math.random() * 64,
      Math.random() * 64,
      1 + Math.random() * 1,
      Math.random() * 1
    );
  }

  const grassTexture = new THREE.CanvasTexture(canvas);
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(256, 256);
  grassTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  grassTexture.minFilter = THREE.LinearMipMapLinearFilter;
  grassTexture.magFilter = THREE.LinearFilter;

  return grassTexture;
}

const grassTexture = createGrassTexture();

// Ground tiles management
const tileSize = config.tileSize;
const tiles = {};
const maxTilesDistance = config.maxTilesDistance;

function getTileKey(x, z) {
  const tileX = Math.floor(x / tileSize);
  const tileZ = Math.floor(z / tileSize);
  return `${tileX}_${tileZ}`;
}

function createTile(x, z) {
  const key = getTileKey(x, z);
  if (tiles[key]) return;

  // Visual ground
  const groundGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
  const groundMaterialVisual = new THREE.MeshPhongMaterial({
    map: grassTexture,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterialVisual);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(x, 0, z);
  ground.receiveShadow = true;
  scene.add(ground);

  // Ground physics body
  const groundBody = new CANNON.Body({
    mass: 0,
    material: groundMaterial,
  });
  const groundShape = new CANNON.Plane();
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  groundBody.position.set(x, 0, z);
  world.addBody(groundBody);

  tiles[key] = { ground, groundBody, objects: [] };
  addObjectsToTile(x, z);
}

function removeTile(key) {
  const tile = tiles[key];
  if (tile) {
    scene.remove(tile.ground);
    world.removeBody(tile.groundBody);

    // Remove all objects associated with the tile
    tile.objects.forEach(({ object, body }) => {
      scene.remove(object);
      if (body) {
        world.removeBody(body);
      }
    });

    delete tiles[key];
  }
}

// Trees, ramps, boosts, and clouds management
function addObjectsToTile(x, z) {
  const distanceFromOrigin = Math.hypot(
    chassisBody.position.x,
    chassisBody.position.z
  );
  const distanceFactor = Math.max(1, distanceFromOrigin / 1000);

  const numTrees = 10;
  for (let i = 0; i < numTrees; i++) {
    const posX = x - tileSize / 2 + Math.random() * tileSize;
    const posZ = z - tileSize / 2 + Math.random() * tileSize;

    // Avoid placing trees on the road
    if (Math.abs(posZ) < 10) continue;

    const tree = new THREE.Group();

    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5);
    const trunkMaterial = new THREE.MeshPhongMaterial({
      color: 0x8b4513,
    }); // Brown color
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2.5;
    trunk.castShadow = true;
    tree.add(trunk);

    const leavesGeometry = new THREE.ConeGeometry(2, 5, 8);
    const leavesMaterial = new THREE.MeshPhongMaterial({
      color: 0x006400,
    }); // Dark green color
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.y = 7.5;
    leaves.castShadow = true;
    tree.add(leaves);

    tree.position.set(posX, 0, posZ);

    scene.add(tree);

    // Physics body for the tree (approximate as a cylinder)
    const treeShape = new CANNON.Cylinder(0.5, 0.5, 5, 8);
    const treeBody = new CANNON.Body({ mass: 0 });
    treeBody.addShape(treeShape);
    treeBody.position.set(posX, 0, posZ);
    world.addBody(treeBody);

    tiles[getTileKey(x, z)].objects.push({
      object: tree,
      body: treeBody,
    });
  }

  const numRamps = 2;
  for (let i = 0; i < numRamps; i++) {
    const posX = x - tileSize / 2 + Math.random() * tileSize;
    const posZ = z - tileSize / 2 + Math.random() * tileSize;
    const rotationY = Math.random() * Math.PI * 2;

    // Avoid placing ramps on the road
    if (Math.abs(posZ) < 10) continue;

    const ramp = createRamp(posX, 0.5, posZ, -Math.PI / 18, rotationY, 0);

    tiles[getTileKey(x, z)].objects.push({
      object: ramp,
      body: ramp.userData.physicsBody,
    });
  }

  const numBoosts = 20;
  for (let i = 0; i < numBoosts; i++) {
    const posX = x - tileSize / 2 + Math.random() * tileSize;
    const posZ = z - tileSize / 2 + Math.random() * tileSize;

    // Avoid placing boosts on the road
    if (Math.abs(posZ) < 10) continue;

    const boost = createBoost(posX, 1, posZ);

    tiles[getTileKey(x, z)].objects.push({
      object: boost,
      body: null, // boosts don't have physics bodies
    });
  }

  // Add clouds
  const numClouds = 2;
  for (let i = 0; i < numClouds; i++) {
    const posX = x - tileSize / 2 + Math.random() * tileSize;
    const posY = 100 + Math.random() * 50; // Clouds are high in the sky
    const posZ = z - tileSize / 2 + Math.random() * tileSize;

    const cloud = createCloud(posX, posY, posZ);

    tiles[getTileKey(x, z)].objects.push({
      object: cloud,
      body: null, // Clouds don't need physics body
    });
  }
}

// Function to create ramps
function createRamp(posX, posY, posZ, rotationX, rotationY, rotationZ) {
  const rampGeometry = new THREE.BoxGeometry(20, 1, 50);
  const rampMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
  const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  ramp.rotation.set(rotationX, rotationY, rotationZ);
  ramp.position.set(posX, posY, posZ);
  scene.add(ramp);

  // Physics body for ramp
  const rampShape = new CANNON.Box(new CANNON.Vec3(10, 0.5, 25));
  const rampBody = new CANNON.Body({ mass: 0 });
  rampBody.addShape(rampShape);
  rampBody.position.set(posX, posY, posZ);
  rampBody.quaternion.setFromEuler(rotationX, rotationY, rotationZ);
  world.addBody(rampBody);

  // Store a reference to the physics body in the ramp mesh
  ramp.userData.physicsBody = rampBody;

  return ramp;
}

// Road management
const roadSegments = {};
const roadLength = 1000;

function createRoadSegment(index) {
  if (roadSegments[index]) return;

  // Create road texture
  function createRoadTexture() {
    const roadCanvas = document.createElement("canvas");
    roadCanvas.width = roadCanvas.height = 64;
    const ctx = roadCanvas.getContext("2d");

    ctx.fillStyle = "#696969";
    ctx.fillRect(0, 0, 64, 64);

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(64, 32);
    ctx.stroke();

    const roadTexture = new THREE.CanvasTexture(roadCanvas);
    roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(100, 1);
    roadTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    roadTexture.minFilter = THREE.LinearMipMapLinearFilter;
    roadTexture.magFilter = THREE.LinearFilter;

    return roadTexture;
  }

  const roadTexture = createRoadTexture();

  const roadGeometry = new THREE.PlaneGeometry(roadLength, 20);
  const roadMaterialVisual = new THREE.MeshPhongMaterial({
    map: roadTexture,
  });
  const road = new THREE.Mesh(roadGeometry, roadMaterialVisual);
  road.rotation.x = -Math.PI / 2;
  road.position.set(index * roadLength, 0.02, 0);
  road.receiveShadow = true;
  scene.add(road);

  // Road physics body
  const roadBody = new CANNON.Body({
    mass: 0,
    material: groundMaterial,
  });
  const roadShape = new CANNON.Box(
    new CANNON.Vec3(roadLength / 2, 0.1, 10)
  );
  roadBody.addShape(roadShape);
  road.position.set(index * roadLength, 0.02, 0);
  world.addBody(roadBody);

  roadSegments[index] = { road, roadBody };

  // Place boosts on the road segment
  const numBoosts = 2;
  for (let i = 0; i < numBoosts; i++) {
    const posX =
      index * roadLength + (Math.random() * roadLength - roadLength / 2);
    const posZ = (Math.random() - 0.5) * 10; // Road width is 20 units, so -10 to 10
    createBoost(posX, 1, posZ);
  }
}

function removeRoadSegment(index) {
  const segment = roadSegments[index];
  if (segment) {
    scene.remove(segment.road);
    world.removeBody(segment.roadBody);
    delete roadSegments[index];
  }
}

// Function to create boosts
const boosts = [];

function createBoost(x, y, z) {
  const boostGeometry = new THREE.SphereGeometry(1, 16, 16); // Increased size
  const boostMaterial = new THREE.MeshPhongMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
  });
  const boost = new THREE.Mesh(boostGeometry, boostMaterial);
  boost.position.set(x, y, z);
  boost.castShadow = true;
  scene.add(boost);
  boosts.push(boost);

  // No physics body needed
  return boost;
}

// Function to create clouds
function createCloud(x, y, z) {
  const cloud = new THREE.Group();

  const cloudMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
  });

  const numParticles = 5 + Math.floor(Math.random() * 5);

  for (let i = 0; i < numParticles; i++) {
    const geometry = new THREE.SphereGeometry(
      Math.random() * 5 + 5,
      16,
      16
    );
    const mesh = new THREE.Mesh(geometry, cloudMaterial);
    mesh.position.set(
      Math.random() * 10 - 5,
      Math.random() * 5,
      Math.random() * 10 - 5
    );
    cloud.add(mesh);
  }

  cloud.position.set(x, y, z);
  scene.add(cloud);

  return cloud;
}

// Car chassis
const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.25, 2));
const chassisBody = new CANNON.Body({ mass: 300 });
chassisBody.addShape(chassisShape);
chassisBody.position.set(0, 1, 0);
chassisBody.angularVelocity.set(0, 0, 0);
chassisBody.angularDamping = 0.9; // Increased from 0.5
chassisBody.linearDamping = 0.0; // Reduced from 0.1

// Car visual
const carMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const carGeometry = new THREE.BoxGeometry(2, 0.5, 4);
const carMesh = new THREE.Mesh(carGeometry, carMaterial);
carMesh.castShadow = true;
scene.add(carMesh);

// Raycast Vehicle
const vehicle = new CANNON.RaycastVehicle({
  chassisBody: chassisBody,
  indexRightAxis: 0,
  indexUpAxis: 1,
  indexForwardAxis: 2,
});

// Updated vehicle suspension options
const options = {
  radius: 0.4,
  directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 80, // Increased from 45
  suspensionRestLength: 0.4,
  frictionSlip: 5,
  dampingRelaxation: 5.5, // Increased from 3.5
  dampingCompression: 6.4, // Increased from 4.4
  maxSuspensionForce: 500000, // Increased from 200000
  rollInfluence: 0.01, // Reduced from 0.01
  axleLocal: new CANNON.Vec3(-1, 0, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(),
  maxSuspensionTravel: 0.4,
  customSlidingRotationalSpeed: -30,
  useCustomSlidingRotationalSpeed: true,
};

// Add wheels
const wheelPositions = [
  new CANNON.Vec3(-0.9, 0, 1.5), // Front left
  new CANNON.Vec3(0.9, 0, 1.5), // Front right
  new CANNON.Vec3(-0.9, 0, -1.5), // Back left
  new CANNON.Vec3(0.9, 0, -1.5), // Back right
];

wheelPositions.forEach((position, index) => {
  options.chassisConnectionPointLocal.copy(position);
  options.isFrontWheel = index < 2 ? true : false;
  vehicle.addWheel(options);
});

vehicle.addToWorld(world);

chassisBody.quaternion.setFromAxisAngle(
  new CANNON.Vec3(0, 1, 0),
  Math.PI / 2
);

// Wheel visuals
const wheelMaterialVisual = new THREE.MeshPhongMaterial({
  color: 0x000000,
});
const wheelGeometry = new THREE.CylinderGeometry(
  options.radius,
  options.radius,
  0.2,
  16
);
const wheelVisuals = [];

vehicle.wheelInfos.forEach((wheel) => {
  const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterialVisual);
  wheelMesh.rotation.z = Math.PI / 2;
  wheelMesh.castShadow = true;
  scene.add(wheelMesh);
  wheelVisuals.push(wheelMesh);
});

// Sync wheels
world.addEventListener("postStep", function () {
  for (let i = 0; i < vehicle.wheelInfos.length; i++) {
    vehicle.updateWheelTransform(i);
    const t = vehicle.wheelInfos[i].worldTransform;
    const wheel = wheelVisuals[i];

    wheel.position.copy(t.position);
    wheel.quaternion.copy(t.quaternion);
  }
});

// Add light
const ambientLight = new THREE.AmbientLight(0xcccccc);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 100, 100);
directionalLight.castShadow = true;

directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;

directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 1000;

directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;

scene.add(directionalLight);

// Position camera
camera.position.set(0, 5, -10);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// Controls
let actions = {
  accelerate: false,
  brake: false,
  left: false,
  right: false,
};

const maxSteerVal = config.maxSteerVal;
const maxForce = config.maxForce;

// Mobile controls using nipple.js
let joystick = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
  const joystickZone = document.getElementById('joystick-zone');
  joystick = nipplejs.create({
    zone: joystickZone,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'white',
    size: 120
  });
  
  joystick.on('move', (evt, data) => {
    const angle = data.angle.radian;
    const force = Math.min(data.force, 1.0);
    
    // Reset actions
    actions.accelerate = false;
    actions.brake = false;
    actions.left = false;
    actions.right = false;
    
    // Forward/backward
    if (angle > Math.PI * 0.75 && angle < Math.PI * 1.25) {
      // Left
      actions.left = true;
    } else if (angle > Math.PI * 1.75 || angle < Math.PI * 0.25) {
      // Right
      actions.right = true;
    }
    
    // Forward/backward - forward is up (around 0 or 2π)
    if (angle > Math.PI * 1.25 && angle < Math.PI * 1.75) {
      // Down - brake
      actions.brake = true;
    } else if ((angle >= 0 && angle < Math.PI * 0.75) || 
              (angle > Math.PI * 1.75 && angle <= Math.PI * 2)) {
      // Up - accelerate
      actions.accelerate = true;
    }
  });
  
  joystick.on('end', () => {
    // Reset all actions when joystick is released
    actions.accelerate = false;
    actions.brake = false;
    actions.left = false;
    actions.right = false;
  });
  
  // Add flip button for mobile
  const flipButton = document.createElement('button');
  flipButton.textContent = 'Flip Car';
  flipButton.style.position = 'absolute';
  flipButton.style.bottom = '150px';
  flipButton.style.right = '20px';
  flipButton.style.padding = '10px';
  flipButton.style.zIndex = '3';
  flipButton.style.background = 'rgba(255, 255, 255, 0.7)';
  flipButton.style.border = 'none';
  flipButton.style.borderRadius = '5px';
  document.body.appendChild(flipButton);
  
  flipButton.addEventListener('touchstart', (event) => {
    event.preventDefault();
    flipCar();
  });
}

document.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      actions.accelerate = true;
      break;
    case "ArrowDown":
    case "KeyS":
      actions.brake = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      actions.left = true;
      break;
    case "ArrowRight":
    case "KeyD":
      actions.right = true;
      break;
    case "KeyF":
      flipCar();
      break;
  }
});

document.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      actions.accelerate = false;
      break;
    case "ArrowDown":
    case "KeyS":
      actions.brake = false;
      vehicle.setBrake(0, 0);
      vehicle.setBrake(0, 1);
      vehicle.setBrake(0, 2);
      vehicle.setBrake(0, 3);
      break;
    case "ArrowLeft":
    case "KeyA":
      actions.left = false;
      break;
    case "ArrowRight":
    case "KeyD":
      actions.right = false;
      break;
  }
});

// Function to flip the car
function flipCar() {
  // Reset the car's rotation to upright
  chassisBody.quaternion.set(
    0,
    chassisBody.quaternion.y,
    0,
    chassisBody.quaternion.w
  );
  chassisBody.angularVelocity.set(0, 0, 0);
  chassisBody.velocity.set(0, 0, 0);
  // Lift the car slightly above ground
  chassisBody.position.y += 1;
}

// Speedometer elements
const needleElement = document.getElementById("needle");
const speedTextElement = document.getElementById("speed-text");

// Tire marks
const tireMarks = [];
const maxTireMarks = 500;
const tireMarkGeometry = new THREE.PlaneGeometry(0.2, 0.5);
const tireMarkMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.DoubleSide,
});

// Acceleration modifier
let accelerationModifier = 1;

// Distance traveled
let distanceTraveled = 0;

// Airborne tracking
let isAirborne = false;
let airborneStartTime = 0;
let currentHeight = 0;
let maxHeight = 0;
let currentAirTime = 0;
let maxAirTime = 0;

// Store other players' vehicles
const otherPlayers = {};

// Physics bodies for other players (for collisions)
const otherPlayerBodies = {};

// Random color for this player
const playerColorIndex = Math.floor(Math.random() * config.carColors.length);
carMesh.material.color.setHex(config.carColors[playerColorIndex]);

// Set up name tags for cars
function createNameTag(username) {
  const nameTag = document.createElement('div');
  nameTag.className = 'player-name';
  nameTag.textContent = username;
  document.body.appendChild(nameTag);
  return nameTag;
}

// Create a car for another player
function createOtherPlayerCar(clientId, initialPosition, initialQuaternion, colorIndex) {
  // Car body
  const otherCarMaterial = new THREE.MeshPhongMaterial({ 
    color: config.carColors[colorIndex % config.carColors.length]
  });
  const otherCarMesh = new THREE.Mesh(carGeometry, otherCarMaterial);
  otherCarMesh.castShadow = true;
  scene.add(otherCarMesh);
  
  // Create physics body for collision
  const otherCarBody = new CANNON.Body({
    mass: 300, // Same mass as player car
    shape: chassisShape,
    position: new CANNON.Vec3(
      initialPosition.x, 
      initialPosition.y, 
      initialPosition.z
    ),
    collisionFilterGroup: 2, // Different group for other players
    collisionFilterMask: 1 | 2 // Collide with ground (1) and other players (2)
  });
  
  // Set collision filter for player's car too
  if (!chassisBody.collisionFilterGroup) {
    chassisBody.collisionFilterGroup = 2;
    chassisBody.collisionFilterMask = 1 | 2;
  }
  
  world.addBody(otherCarBody);
  otherPlayerBodies[clientId] = otherCarBody;
  
  // Wheels
  const otherWheelVisuals = [];
  for (let i = 0; i < 4; i++) {
    const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterialVisual);
    wheelMesh.rotation.z = Math.PI / 2;
    wheelMesh.castShadow = true;
    scene.add(wheelMesh);
    otherWheelVisuals.push(wheelMesh);
  }

  // Username tag
  const nameTag = createNameTag(room.peers[clientId]?.username || 'Player');
  
  return {
    car: otherCarMesh,
    wheels: otherWheelVisuals,
    nameTag,
    body: otherCarBody,
    lastUpdate: Date.now()
  };
}

// Initialize multiplayer
async function initializeMultiplayer() {
  await room.initialize();
  
  // Set initial presence
  room.updatePresence({
    position: {
      x: chassisBody.position.x,
      y: chassisBody.position.y,
      z: chassisBody.position.z
    },
    quaternion: {
      x: chassisBody.quaternion.x,
      y: chassisBody.quaternion.y,
      z: chassisBody.quaternion.z,
      w: chassisBody.quaternion.w
    },
    wheelPositions: wheelPositions.map((_, i) => {
      const transform = vehicle.wheelInfos[i].worldTransform;
      return {
        x: transform.position.x,
        y: transform.position.y,
        z: transform.position.z
      };
    }),
    wheelQuaternions: wheelPositions.map((_, i) => {
      const transform = vehicle.wheelInfos[i].worldTransform;
      return {
        x: transform.quaternion.x,
        y: transform.quaternion.y,
        z: transform.quaternion.z,
        w: transform.quaternion.w
      };
    }),
    accelerationModifier: accelerationModifier,
    colorIndex: playerColorIndex,
    topSpeed: 0
  });
  
  // Subscribe to presence updates
  room.subscribePresence((presence) => {
    // Handle presence updates
    for (const clientId in presence) {
      // Skip ourselves
      if (clientId === room.clientId) continue;
      
      const playerData = presence[clientId];
      if (!playerData) continue;
      
      // If this is a new player, create their car
      if (!otherPlayers[clientId] && playerData.position) {
        otherPlayers[clientId] = createOtherPlayerCar(
          clientId,
          playerData.position,
          playerData.quaternion,
          playerData.colorIndex || 0
        );
      }
      
      // Update car position and rotation
      if (otherPlayers[clientId] && playerData.position) {
        const otherCar = otherPlayers[clientId].car;
        const otherBody = otherPlayers[clientId].body;
        const newPos = playerData.position;
        const newRot = playerData.quaternion;
        
        otherCar.position.set(newPos.x, newPos.y, newPos.z);
        otherCar.quaternion.set(newRot.x, newRot.y, newRot.z, newRot.w);
        
        // Update physics body position & rotation
        otherBody.position.set(newPos.x, newPos.y, newPos.z);
        otherBody.quaternion.set(newRot.x, newRot.y, newRot.z, newRot.w);
        
        // Also update linear and angular velocity
        if (playerData.velocity) {
          otherBody.velocity.set(
            playerData.velocity.x, 
            playerData.velocity.y, 
            playerData.velocity.z
          );
        }
        
        if (playerData.angularVelocity) {
          otherBody.angularVelocity.set(
            playerData.angularVelocity.x, 
            playerData.angularVelocity.y, 
            playerData.angularVelocity.z
          );
        }
        
        // Update wheels
        if (playerData.wheelPositions && playerData.wheelQuaternions) {
          for (let i = 0; i < Math.min(4, playerData.wheelPositions.length); i++) {
            const wheelPos = playerData.wheelPositions[i];
            const wheelRot = playerData.wheelQuaternions[i];
            const wheelMesh = otherPlayers[clientId].wheels[i];
            
            wheelMesh.position.set(wheelPos.x, wheelPos.y, wheelPos.z);
            wheelMesh.quaternion.set(wheelRot.x, wheelRot.y, wheelRot.z, wheelRot.w);
          }
        }
        
        otherPlayers[clientId].lastUpdate = Date.now();
      }
    }
  });
  
  // Handle peer connections/disconnections
  room.subscribePresence(() => {
    // Clean up disconnected players
    for (const clientId in otherPlayers) {
      if (!room.presence[clientId]) {
        // Player disconnected, remove their car
        const player = otherPlayers[clientId];
        scene.remove(player.car);
        player.wheels.forEach(wheel => scene.remove(wheel));
        document.body.removeChild(player.nameTag);
        
        // Remove physics body
        world.removeBody(player.body);
        delete otherPlayerBodies[clientId];
        delete otherPlayers[clientId];
      }
    }
    
    // Update name tags for existing players
    for (const clientId in otherPlayers) {
      const username = room.peers[clientId]?.username || 'Player';
      otherPlayers[clientId].nameTag.textContent = username;
    }
  });
  
  // Listen for collision events to broadcast impacts
  world.addEventListener('beginContact', function(event) {
    const bodyA = event.bodyA;
    const bodyB = event.bodyB;
    
    // Check if one body is our car and the other is another player
    if (bodyA === chassisBody || bodyB === chassisBody) {
      const otherBody = bodyA === chassisBody ? bodyB : bodyA;
      
      // Find which player this body belongs to
      let collidedClientId = null;
      for (const clientId in otherPlayerBodies) {
        if (otherPlayerBodies[clientId] === otherBody) {
          collidedClientId = clientId;
          break;
        }
      }
      
      if (collidedClientId) {
        // Calculate impact velocity
        const relativeVelocity = new CANNON.Vec3();
        relativeVelocity.copy(chassisBody.velocity);
        relativeVelocity.vsub(otherBody.velocity, relativeVelocity);
        const impactSpeed = relativeVelocity.length();
        
        // Only register significant impacts
        if (impactSpeed > 10) {
          // Play collision sound or add visual effect here
          console.log(`Collision with ${room.peers[collidedClientId]?.username} at ${impactSpeed.toFixed(2)} m/s`);
          
          // Broadcast collision event
          room.updatePresence({
            collision: {
              withClientId: collidedClientId,
              speed: impactSpeed,
              timestamp: Date.now()
            }
          });
        }
      }
    }
  });
  
  room.subscribePresence(() => {
    updateLeaderboard();
  });
}

let topSpeed = 0;

function updateLeaderboard() {
  const leaderboardDiv = document.getElementById('leaderboard');
  const entries = Object.entries(room.presence)
    .map(([clientId, data]) => ({
      clientId,
      username: room.peers[clientId]?.username || 'Player',
      maxHeight: data.maxHeight || 0,
      maxAirTime: data.maxAirTime || 0
    }))
    .sort((a, b) => b.maxHeight - a.maxHeight);

  // Clear existing entries
  while(leaderboardDiv.firstChild) {
    leaderboardDiv.removeChild(leaderboardDiv.firstChild);
  }

  // Add title
  const title = document.createElement('h2');
  title.textContent = 'Highest Jumps';
  leaderboardDiv.appendChild(title);

  // Add entries
  entries.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'leaderboard-entry';
    if(entry.clientId === room.clientId) {
      div.className += ' current-player';
    }
    div.innerHTML = `
      <span>${entry.username}</span>
      <span>${Math.round(entry.maxHeight * 10) / 10}m (${Math.round(entry.maxAirTime * 10) / 10}s)</span>
    `;
    leaderboardDiv.appendChild(div);
  });
}

// Initialize multiplayer
initializeMultiplayer();

// Animation loop
const timeStep = 1 / 60;
const clock = new THREE.Clock();
let tireMarkTimer = 0;
let lastUpdateTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  
  // Controls
  let force = 0;
  let steer = 0;

  if (actions.left) {
    steer = maxSteerVal;
  }
  if (actions.right) {
    steer = -maxSteerVal;
  }

  vehicle.setSteeringValue(steer, 0);
  vehicle.setSteeringValue(steer, 1);

  // Get the local forward speed
  const localVelocity = new CANNON.Vec3();
  chassisBody.vectorToLocalFrame(chassisBody.velocity, localVelocity);
  const forwardSpeed = localVelocity.z;

  // used for higher acceleration so it has no speed cap and stops flipping
  const mode2driving =
    accelerationModifier > 5 && chassisBody.position.y < 1;

  // Apply engine force or brake
  if (actions.accelerate) {
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);

    // if mode2driving, add force to the car
    if (mode2driving) {
      chassisBody.applyLocalForce(
        new CANNON.Vec3(0, 0, 500 * accelerationModifier),
        new CANNON.Vec3(0, 0, 0)
      );
      force = 0;
    } else {
      force = -maxForce * accelerationModifier;
    }
  } else if (actions.brake) {
    if (mode2driving) {
      // Just directly apply force to the car (stops flipping)
      chassisBody.applyLocalForce(
        new CANNON.Vec3(0, 0, -500 * accelerationModifier),
        new CANNON.Vec3(0, 0, 0)
      );
      vehicle.setBrake(0, 0);
      vehicle.setBrake(0, 1);
      vehicle.setBrake(0, 2);
      vehicle.setBrake(0, 3);
    } else {
      if (forwardSpeed > 0) {
        // Regular brake force
        force = 0;
        const scaledBrakeForce = 20 * accelerationModifier; // Base brake force * acceleration modifier
        vehicle.setBrake(scaledBrakeForce, 0);
        vehicle.setBrake(scaledBrakeForce, 1);
        vehicle.setBrake(scaledBrakeForce, 2);
        vehicle.setBrake(scaledBrakeForce, 3);
      } else {
        // Car is stopped or moving very slowly, start reversing
        force = maxForce * accelerationModifier;
        vehicle.setBrake(0, 0);
        vehicle.setBrake(0, 1);
        vehicle.setBrake(0, 2);
        vehicle.setBrake(0, 3);
      }
    }
  } else {
    force = 0;
    vehicle.setBrake(0.5, 0);
    vehicle.setBrake(0.5, 1);
    vehicle.setBrake(0.5, 2);
    vehicle.setBrake(0.5, 3);
  }

  vehicle.applyEngineForce(force, 0);
  vehicle.applyEngineForce(force, 1);
  vehicle.applyEngineForce(force, 2);
  vehicle.applyEngineForce(force, 3);

  world.step(timeStep, delta, 3);

  // Update car visual position
  carMesh.position.copy(chassisBody.position);
  carMesh.quaternion.copy(chassisBody.quaternion);

  // Update distance traveled
  distanceTraveled += chassisBody.velocity.length() * delta;
  document.getElementById("distance-text").textContent =
    "Distance: " + distanceTraveled.toFixed(0) + " m";

  // Add height and air time tracking
  const heightFromGround = chassisBody.position.y;
  currentHeight = heightFromGround;
  
  // Check if we're airborne
  if (heightFromGround > config.groundThreshold) {
    if (!isAirborne) {
      // Just became airborne
      isAirborne = true;
      airborneStartTime = Date.now();
    }
    
    // Update max height if current height is higher
    if (heightFromGround > maxHeight) {
      maxHeight = heightFromGround;
      // Broadcast new max height
      room.updatePresence({
        maxHeight: maxHeight,
        maxAirTime: maxAirTime
      });
    }
  } else if (isAirborne) {
    // Just landed
    isAirborne = false;
    const airTime = (Date.now() - airborneStartTime) / 1000;
    
    if (airTime > config.minAirTimeToRecord) {
      currentAirTime = airTime;
      if (airTime > maxAirTime) {
        maxAirTime = airTime;
        // Broadcast new max air time along with height
        room.updatePresence({
          maxHeight: maxHeight,
          maxAirTime: maxAirTime
        });
      }
    }
  }

  // Camera follows the car
  const relativeCameraOffset = new THREE.Vector3(0, 5, -10);
  const cameraOffset = relativeCameraOffset.applyMatrix4(
    carMesh.matrixWorld
  );

  // Smoothly interpolate camera position with lower lerp factor
  camera.position.lerp(cameraOffset, 0.05); // Changed from 0.1 to 0.05

  // Add smooth look-at interpolation
  const targetPosition = new THREE.Vector3();
  targetPosition.copy(carMesh.position);
  targetPosition.y += 2; // Look slightly above the car
  const currentLookAt = new THREE.Vector3();
  camera.getWorldDirection(currentLookAt);
  currentLookAt.multiplyScalar(10).add(camera.position);
  currentLookAt.lerp(targetPosition, 0.05);
  camera.lookAt(currentLookAt);

  // Update speedometer
  const speed = chassisBody.velocity.length();
  const displayedSpeed = Math.abs(speed * 3.6).toFixed(0);
  
  // Update top speed if current speed is higher
  if (speed * 3.6 > topSpeed) {
    topSpeed = speed * 3.6;
    // Broadcast new top speed
    room.updatePresence({
      topSpeed: topSpeed
    });
  }
  
  speedTextElement.textContent = displayedSpeed + " km/h";
  
  // Update speedometer background color
  const speedometerElement = document.getElementById("speedometer");
  speedometerElement.style.background =
    getSpeedometerColor(displayedSpeed);

  // Update acceleration text
  document.getElementById("acceleration-text").textContent =
    "Acceleration: " + accelerationModifier.toFixed(1);

  // Create tire marks
  tireMarkTimer += delta;
  if (tireMarkTimer > 0.05) {
    tireMarkTimer = 0;

    vehicle.wheelInfos.forEach((wheelInfo, index) => {
      const position = wheelInfo.worldTransform.position.clone();
      const quaternion = wheelInfo.worldTransform.quaternion.clone();

      const tireMark = new THREE.Mesh(
        tireMarkGeometry,
        tireMarkMaterial
      );
      tireMark.position.copy(position);
      tireMark.quaternion.copy(quaternion);

      // Adjust tire mark to be on the ground
      tireMark.rotateX(Math.PI / 2);
      tireMark.position.y = 0.01;

      scene.add(tireMark);
      tireMarks.push(tireMark);

      if (tireMarks.length > maxTireMarks) {
        const oldTireMark = tireMarks.shift();
        scene.remove(oldTireMark);
      }
    });
  }

  // Generate new ground tiles and road segments as needed
  const carX = chassisBody.position.x;
  const carZ = chassisBody.position.z;

  const tileCenterX =
    Math.floor(carX / tileSize) * tileSize + tileSize / 2;
  const tileCenterZ =
    Math.floor(carZ / tileSize) * tileSize + tileSize / 2;

  const tileRange = 2; // Increase range to generate more tiles
  for (let dx = -tileRange; dx <= tileRange; dx++) {
    for (let dz = -tileRange; dz <= tileRange; dz++) {
      const x = tileCenterX + dx * tileSize;
      const z = tileCenterZ + dz * tileSize;
      createTile(x, z);
    }
  }

  // Remove distant tiles
  for (const key in tiles) {
    const tile = tiles[key];
    const distance = tile.ground.position.distanceTo(
      chassisBody.position
    );
    if (distance > maxTilesDistance) {
      removeTile(key);
    }
  }

  // Generate new road segments
  const roadIndex = Math.floor(carX / roadLength);
  const roadRange = 5; // Increase range to generate more road segments
  for (let i = roadIndex - roadRange; i <= roadIndex + roadRange; i++) {
    createRoadSegment(i);
  }

  // Remove distant road segments
  for (const index in roadSegments) {
    const segment = roadSegments[index];
    const distance = Math.abs(
      segment.road.position.z - chassisBody.position.z
    );
    if (distance > maxTilesDistance * 2) {
      removeRoadSegment(index);
    }
  }

  // Remove distant boosts
  for (let i = boosts.length - 1; i >= 0; i--) {
    const boost = boosts[i];
    const distance = boost.position.distanceTo(chassisBody.position);
    if (distance > maxTilesDistance) {
      scene.remove(boost);
      boosts.splice(i, 1);
    }
  }

  // Check for boosts collection - MULTIPLAYER VERSION
  for (let i = boosts.length - 1; i >= 0; i--) {
    const boost = boosts[i];
    const distance = boost.position.distanceTo(carMesh.position);
    if (distance < 2) {
      // Store the ID before removing
      const boostId = boost.userData.id;
      
      // Remove boost from scene
      scene.remove(boost);
      boosts.splice(i, 1);

      // Multiply accelerationModifier locally
      accelerationModifier *= 1.1;
      
      // Update presence and notify others about the collected boost
      room.updateRoomState({
        collectableStatus: {
          [boostId]: {
            collected: true,
            collectedBy: room.clientId
          }
        }
      });
    }
  }

  // Update our position in the room
  const now = Date.now();
  if (now - lastUpdateTime > config.updateRate) {
    lastUpdateTime = now;
    room.updatePresence({
      position: {
        x: chassisBody.position.x,
        y: chassisBody.position.y,
        z: chassisBody.position.z
      },
      quaternion: {
        x: chassisBody.quaternion.x,
        y: chassisBody.quaternion.y,
        z: chassisBody.quaternion.z,
        w: chassisBody.quaternion.w
      },
      velocity: {
        x: chassisBody.velocity.x,
        y: chassisBody.velocity.y,
        z: chassisBody.velocity.z
      },
      angularVelocity: {
        x: chassisBody.angularVelocity.x,
        y: chassisBody.angularVelocity.y,
        z: chassisBody.angularVelocity.z
      },
      wheelPositions: vehicle.wheelInfos.map(info => {
        const pos = info.worldTransform.position;
        return { x: pos.x, y: pos.y, z: pos.z };
      }),
      wheelQuaternions: vehicle.wheelInfos.map(info => {
        const quat = info.worldTransform.quaternion;
        return { x: quat.x, y: quat.y, z: quat.z, w: quat.w };
      }),
      accelerationModifier: accelerationModifier,
      maxHeight: maxHeight,
      maxAirTime: maxAirTime,
      currentHeight: currentHeight
    });
  }

  // Move light so the shadows show up no matter where the car is
  directionalLight.target.position.set(
    camera.position.x,
    0,
    camera.position.z
  );
  directionalLight.target.updateMatrixWorld();
  directionalLight.position
    .set(camera.position.x + 100, 100, camera.position.z - 100)
    .add(new THREE.Vector3(10, 10, 5));
    
  // Update player nametags
  for (const clientId in otherPlayers) {
    const player = otherPlayers[clientId];
    const position = player.car.position.clone();
    position.y += 3; // Position above the car
    
    // Convert 3D position to screen position
    const screenPosition = position.clone();
    screenPosition.project(camera);
    
    const left = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
    const top = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
    
    player.nameTag.style.left = `${left}px`;
    player.nameTag.style.top = `${top}px`;
    
    // Hide nametag if behind camera
    if (screenPosition.z > 1) {
      player.nameTag.style.display = 'none';
    } else {
      player.nameTag.style.display = 'block';
    }
  }
  
  renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Helper function to get speedometer color
function getSpeedometerColor(speed) {
  // Speed thresholds
  const redThreshold = 1000; // Speed at which background becomes fully red
  const rainbowThreshold = 1000; // Speed at which rainbow effect starts

  if (speed < redThreshold) {
    // Gradually transition from dark gray to red
    const intensity = Math.min(speed / redThreshold, 1);
    return `radial-gradient(
      circle at 75px 75px,
      rgb(${68 + 187 * intensity}, ${68 - 68 * intensity}, ${
        68 - 68 * intensity
      }) 40%,
      rgb(${34 + 187 * intensity}, ${34 - 34 * intensity}, ${
        34 - 34 * intensity
      }) 70%,
      rgb(${0 + 187 * intensity}, 0, 0) 100%
    )`;
  } else {
    // Rainbow effect after redThreshold
    const hue = ((speed - rainbowThreshold) * 0.1) % 360;
    const rgb = HSLToRGB(hue, 100, 50);
    const rgb2 = HSLToRGB(hue, 100, 40);
    const rgb3 = HSLToRGB(hue, 100, 30);

    return `radial-gradient(
      circle at 75px 75px,
      rgb(${rgb.r}, ${rgb.g}, ${rgb.b}) 40%,
      rgb(${rgb2.r}, ${rgb2.g}, ${rgb2.b}) 70%,
      rgb(${rgb3.r}, ${rgb3.g}, ${rgb3.b}) 100%
    )`;
  }
}

// Helper function for HSL to RGB conversion
function HSLToRGB(h, s, l) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}
