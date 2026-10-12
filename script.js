const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const selectedBlockLabel = document.getElementById("selected-block");
const keys = {};
const inventoryButtons = [...document.querySelectorAll(".block")];

const MAP_SIZE = 20;
const FOV = Math.PI / 3;
const MOVE_SPEED = 2.7;
const TURN_SPEED = 1.8;
const MAX_VIEW = 8;

const blockColors = {
  0: { wall: "#000000", shade: "#000000" },
  1: { wall: "#8edb68", shade: "#5ea641" },
  2: { wall: "#c48a5d", shade: "#8e5b33" },
  3: { wall: "#b0b7c2", shade: "#6a7280" },
  4: { wall: "#d8a45d", shade: "#9d692e" },
  5: { wall: "#69d66b", shade: "#349d42" },
  6: { wall: "#d77a5b", shade: "#9d4035" }
};

const blockNames = {
  1: "Grass",
  2: "Dirt",
  3: "Stone",
  4: "Wood",
  5: "Leaves",
  6: "Brick"
};

const world = buildWorld();
const player = {
  x: 3.5,
  y: 3.5,
  angle: 0.3,
  radius: 0.18
};

let selectedBlock = 1;
let targetTile = null;

function buildWorld() {
  const grid = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(0));

  for (let x = 0; x < MAP_SIZE; x++) {
    const height = 3 + Math.floor(Math.sin(x * 0.8) * 1.4 + Math.cos(x * 0.45) * 1.2);
    for (let y = 0; y < MAP_SIZE; y++) {
      if (y < height) {
        grid[y][x] = 1;
      }
    }
  }

  for (let i = 0; i < 24; i++) {
    const x = 2 + Math.floor(Math.random() * (MAP_SIZE - 5));
    const y = 2 + Math.floor(Math.random() * (MAP_SIZE - 5));
    const trunk = 2 + Math.floor(Math.random() * 2);
    for (let t = 0; t < trunk; t++) {
      if (y - t >= 0) grid[y - t][x] = 4;
    }
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y - trunk + dy;
        if (Math.abs(dx) + Math.abs(dy) < 6 && nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) {
          grid[ny][nx] = 5;
        }
      }
    }
  }

  for (let x = 0; x < MAP_SIZE; x++) {
    grid[MAP_SIZE - 1][x] = 3;
    grid[MAP_SIZE - 2][x] = 2;
  }

  return grid;
}

function getTile(x, y) {
  if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return 1;
  return world[y][x] || 0;
}

function setTile(x, y, value) {
  if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return;
  world[y][x] = value;
}

function setSelectedBlock(value) {
  selectedBlock = value;
  selectedBlockLabel.textContent = blockNames[selectedBlock] || "Grass";
  inventoryButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.block) === selectedBlock);
  });
}

function isSolid(x, y) {
  return getTile(Math.floor(x), Math.floor(y)) !== 0;
}

function movePlayer(dt) {
  const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

  if (forward !== 0 || strafe !== 0) {
    const step = MOVE_SPEED * dt;
    const dx = Math.cos(player.angle) * forward + Math.cos(player.angle + Math.PI / 2) * strafe;
    const dy = Math.sin(player.angle) * forward + Math.sin(player.angle + Math.PI / 2) * strafe;
    const nextX = player.x + dx * step;
    const nextY = player.y + dy * step;

    if (!isSolid(nextX + player.radius, player.y)) player.x = nextX;
    if (!isSolid(player.x, nextY + player.radius)) player.y = nextY;
  }

  if (keys.KeyQ || keys.ArrowLeft) player.angle -= TURN_SPEED * dt;
  if (keys.KeyE || keys.ArrowRight) player.angle += TURN_SPEED * dt;
}

function castRay(rayAngle) {
  let distance = 0;
  let tileX = 0;
  let tileY = 0;
  let tileType = 0;

  while (distance < MAX_VIEW) {
    distance += 0.02;
    const x = player.x + Math.cos(rayAngle) * distance;
    const y = player.y + Math.sin(rayAngle) * distance;
    tileX = Math.floor(x);
    tileY = Math.floor(y);
    tileType = getTile(tileX, tileY);

    if (tileType !== 0) {
      break;
    }
  }

  return {
    distance,
    tileType,
    tileX,
    tileY,
    corrected: distance * Math.cos(rayAngle - player.angle)
  };
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);
  sky.addColorStop(0, "#7ec9ff");
  sky.addColorStop(1, "#dff8ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

  const floor = ctx.createLinearGradient(0, canvas.height / 2, 0, canvas.height);
  floor.addColorStop(0, "#b1dc70");
  floor.addColorStop(1, "#6ca24d");
  ctx.fillStyle = floor;
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
}

function drawWalls() {
  const rays = 240;
  const rayStep = FOV / rays;
  const startAngle = player.angle - FOV / 2;

  for (let i = 0; i < rays; i++) {
    const angle = startAngle + i * rayStep;
    const hit = castRay(angle);
    const xPos = (i / rays) * canvas.width;
    const sliceWidth = Math.max(2, canvas.width / rays + 1);
    const wallHeight = Math.min(canvas.height, (canvas.height / Math.max(0.2, hit.corrected)) * 0.82);
    const top = canvas.height / 2 - wallHeight / 2;
    const colors = blockColors[hit.tileType] || blockColors[1];
    const shade = Math.max(0.15, 1 - hit.distance / MAX_VIEW);

    ctx.fillStyle = colors.wall;
    ctx.globalAlpha = shade;
    ctx.fillRect(xPos, top, sliceWidth, wallHeight);

    ctx.fillStyle = colors.shade;
    ctx.fillRect(xPos, top, sliceWidth, 2);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(xPos, canvas.height / 2 + wallHeight / 2, sliceWidth, canvas.height / 2 - wallHeight / 2);
  }
}

function drawMiniMap() {
  const miniSize = 140;
  const tileSize = miniSize / MAP_SIZE;
  const offsetX = canvas.width - miniSize - 20;
  const offsetY = 20;

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(offsetX - 6, offsetY - 6, miniSize + 12, miniSize + 12);

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      if (getTile(x, y) !== 0) {
        ctx.fillStyle = blockColors[getTile(x, y)].wall || "#333";
        ctx.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
      }
    }
  }

  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(offsetX + player.x * tileSize, offsetY + player.y * tileSize);
  ctx.lineTo(
    offsetX + (player.x + Math.cos(player.angle) * 1.2) * tileSize,
    offsetY + (player.y + Math.sin(player.angle) * 1.2) * tileSize
  );
  ctx.stroke();

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(offsetX + player.x * tileSize, offsetY + player.y * tileSize, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrosshair() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();

  if (targetTile) {
    const miniSize = 140;
    const tileSize = miniSize / MAP_SIZE;
    const offsetX = canvas.width - miniSize - 20;
    const offsetY = 20;
    ctx.strokeStyle = "#ffeb3b";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      offsetX + targetTile.x * tileSize + 1,
      offsetY + targetTile.y * tileSize + 1,
      tileSize - 2,
      tileSize - 2
    );
  }
}

function drawHud() {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(18, 18, 220, 54);
  ctx.fillStyle = "#f5f7ff";
  ctx.font = "bold 18px Arial";
  ctx.fillText("MiniCraft 3D", 30, 42);
  ctx.font = "14px Arial";
  ctx.fillText("Block: " + blockNames[selectedBlock], 30, 62);
}

function castMouseRay(mouseX) {
  const relativeX = mouseX / canvas.width;
  const rayAngle = player.angle - FOV / 2 + relativeX * FOV;
  return castRay(rayAngle);
}

function updateTargetedTile() {
  const centerHit = castMouseRay(canvas.width / 2);
  targetTile = centerHit.tileType !== 0 ? { x: centerHit.tileX, y: centerHit.tileY } : null;
}

function removeBlockAtTile(x, y) {
  if (x <= 0 || y <= 0 || x >= MAP_SIZE - 1 || y >= MAP_SIZE - 1) return;
  if (Math.abs(player.x - x) < 1 && Math.abs(player.y - y) < 1) return;
  setTile(x, y, 0);
}

function breakTargetedBlock() {
  if (!targetTile) return;
  removeBlockAtTile(targetTile.x, targetTile.y);
  targetTile = null;
}

function placeBlockAtTile(x, y) {
  if (x <= 0 || y <= 0 || x >= MAP_SIZE - 1 || y >= MAP_SIZE - 1) return;
  if (Math.abs(player.x - x) < 1 && Math.abs(player.y - y) < 1) return;
  setTile(x, y, selectedBlock);
}

function handlePointer(event) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const hit = castMouseRay(mouseX);

  if (event.button === 0) {
    if (hit.tileType !== 0) {
      removeBlockAtTile(hit.tileX, hit.tileY);
    }
  } else if (event.button === 2) {
    const placeX = Math.round(player.x + Math.cos(player.angle - FOV / 2 + (mouseX / canvas.width) * FOV) * (hit.distance + 0.7));
    const placeY = Math.round(player.y + Math.sin(player.angle - FOV / 2 + (mouseX / canvas.width) * FOV) * (hit.distance + 0.7));
    placeBlockAtTile(placeX, placeY);
  }
}

function render() {
  updateTargetedTile();
  drawBackground();
  drawWalls();
  drawMiniMap();
  drawCrosshair();
  drawHud();
}

let lastTime = 0;
function updateGame(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0.016, 0.032);
  lastTime = time;

  movePlayer(dt);
  render();
  requestAnimationFrame(updateGame);
}

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "KeyQ") player.angle -= TURN_SPEED * 0.2;
  if (event.code === "KeyE") player.angle += TURN_SPEED * 0.2;
  if (event.code === "Digit1") setSelectedBlock(1);
  if (event.code === "Digit2") setSelectedBlock(2);
  if (event.code === "Digit3") setSelectedBlock(3);
  if (event.code === "Digit4") setSelectedBlock(4);
  if (event.code === "Digit5") setSelectedBlock(5);
  if (event.code === "Digit6") setSelectedBlock(6);
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

canvas.addEventListener("mousedown", handlePointer);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

inventoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedBlock(Number(button.dataset.block));
  });
});

setSelectedBlock(selectedBlock);
requestAnimationFrame(updateGame);
