const canvas = document.getElementById("benchCanvas");
const ctx = canvas.getContext("2d");

const bench = {
  worldLengthCm: 200,
  sourceX: 8,
};

const source = {
  direction: 0,
};

const lenses = [];
let lensId = 1;

const lensesContainer = document.getElementById("lensesContainer");
const addConvergingBtn = document.getElementById("addConverging");
const addDivergingBtn = document.getElementById("addDiverging");
const resetLensesBtn = document.getElementById("resetLenses");
const sourceDirectionInput = document.getElementById("sourceDirection");
const sourceDirectionLabel = document.getElementById("sourceDirectionLabel");
const resetSourceDirectionBtn = document.getElementById("resetSourceDirection");
const lensVisualHeightPx = 190;
const lensGrabTolerancePx = 12;
let dragState = null;

addConvergingBtn.addEventListener("click", () => addLens("converging"));
addDivergingBtn.addEventListener("click", () => addLens("diverging"));
resetLensesBtn.addEventListener("click", () => {
  lenses.length = 0;
  renderLensControls();
  draw();
});
sourceDirectionInput.addEventListener("input", () => {
  source.direction = Number(sourceDirectionInput.value);
  sourceDirectionLabel.textContent = `Směr svazku: ${getDirectionText(
    source.direction
  )}`;
  draw();
});
resetSourceDirectionBtn.addEventListener("click", () => {
  source.direction = 0;
  sourceDirectionInput.value = "0";
  sourceDirectionLabel.textContent = `Směr svazku: ${getDirectionText(
    source.direction
  )}`;
  draw();
});
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);

function addLens(type) {
  lenses.push({
    id: lensId++,
    type,
    x: 90 + Math.random() * 50,
    focalLength: type === "converging" ? 20 : -20,
  });
  lenses.sort((a, b) => a.x - b.x);
  renderLensControls();
  draw();
}

function renderLensControls() {
  lensesContainer.innerHTML = "";

  if (lenses.length === 0) {
    const hint = document.createElement("p");
    hint.textContent = "Žádná čočka. Přidej spojku nebo rozptylku.";
    lensesContainer.appendChild(hint);
    return;
  }

  lenses.forEach((lens) => {
    lens.focalLength = normalizeFocalLength(lens.type, lens.focalLength);

    const card = document.createElement("article");
    card.className = "lensCard";

    const header = document.createElement("div");
    header.className = "lensHeader";

    const title = document.createElement("h3");
    title.className = "lensTitle";
    title.textContent =
      lens.type === "converging"
        ? `Spojka #${lens.id}`
        : `Rozptylka #${lens.id}`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "removeBtn";
    removeBtn.textContent = "Odebrat";
    removeBtn.addEventListener("click", () => {
      const index = lenses.findIndex((l) => l.id === lens.id);
      if (index >= 0) {
        lenses.splice(index, 1);
        renderLensControls();
        draw();
      }
    });

    header.appendChild(title);
    header.appendChild(removeBtn);
    card.appendChild(header);

    const powerControl = buildRangeControl({
      label: `Ohnisková vzdálenost: ${lens.focalLength.toFixed(0)} cm`,
      min: lens.type === "converging" ? 5 : -120,
      max: lens.type === "converging" ? 120 : -5,
      step: 1,
      value: lens.focalLength,
      onInput: (value, labelNode) => {
        lens.focalLength = normalizeFocalLength(lens.type, Number(value));
        labelNode.textContent = `Ohnisková vzdálenost: ${lens.focalLength.toFixed(
          0
        )} cm`;
        draw();
      },
    });

    card.appendChild(powerControl);
    lensesContainer.appendChild(card);
  });
}

function buildRangeControl({ label, min, max, step, value, onInput }) {
  const wrap = document.createElement("div");
  wrap.className = "control";

  const labelNode = document.createElement("label");
  labelNode.textContent = label;

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => onInput(input.value, labelNode));

  wrap.appendChild(labelNode);
  wrap.appendChild(input);
  return wrap;
}

function normalizeFocalLength(type, value) {
  const minAbs = 5;
  if (type === "diverging") {
    return Math.min(-minAbs, value);
  }
  return Math.max(minAbs, value);
}

function getDirectionText(direction) {
  if (direction < -0.1) {
    return `rozbíhavý (${direction.toFixed(2)})`;
  }
  if (direction > 0.1) {
    return `sbíhavý (${direction.toFixed(2)})`;
  }
  return `rovnoběžný (${direction.toFixed(2)})`;
}

function createRays() {
  const rayIndices = [-2, -1, 0, 1, 2];
  const baseSpacingCm = 7;
  const startSpreadFactor =
    source.direction < 0 ? Math.max(0, 1 + 2.6 * source.direction) : 1;
  const anglePerIndex = 0.09;

  return rayIndices.map((index) => ({
    y: index * baseSpacingCm * startSpreadFactor,
    theta: -source.direction * index * anglePerIndex,
  }));
}

function xToPx(x) {
  return (x / bench.worldLengthCm) * canvas.width;
}

function pxToX(px) {
  return (px / canvas.width) * bench.worldLengthCm;
}

function yToPx(y) {
  return canvas.height * 0.5 - y * 3.2;
}

function lensHalfHeightCm() {
  return (lensVisualHeightPx / 2) / 3.2;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function getLensAtCanvasPoint(point) {
  const centerY = canvas.height / 2;
  const top = centerY - lensVisualHeightPx / 2;
  const bottom = centerY + lensVisualHeightPx / 2;
  if (point.y < top || point.y > bottom) {
    return null;
  }

  for (let i = lenses.length - 1; i >= 0; i -= 1) {
    const lens = lenses[i];
    const lensPx = xToPx(lens.x);
    if (Math.abs(point.x - lensPx) <= lensGrabTolerancePx) {
      return lens;
    }
  }
  return null;
}

function handlePointerDown(event) {
  const point = getCanvasPoint(event);
  const lens = getLensAtCanvasPoint(point);
  if (!lens) {
    return;
  }
  canvas.setPointerCapture(event.pointerId);
  dragState = {
    lensId: lens.id,
    pointerId: event.pointerId,
  };
  canvas.style.cursor = "grabbing";
}

function handlePointerMove(event) {
  if (dragState && event.pointerId !== dragState.pointerId) {
    return;
  }

  const point = getCanvasPoint(event);

  if (dragState) {
    const lens = lenses.find((item) => item.id === dragState.lensId);
    if (!lens) {
      dragState = null;
      return;
    }
    const minX = 20;
    const maxX = 190;
    lens.x = Math.max(minX, Math.min(maxX, pxToX(point.x)));
    lenses.sort((a, b) => a.x - b.x);
    renderLensControls();
    draw();
    canvas.style.cursor = "grabbing";
    return;
  }

  canvas.style.cursor = getLensAtCanvasPoint(point) ? "grab" : "default";
}

function handlePointerUp(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  dragState = null;
  canvas.style.cursor = "default";
}

function drawBench() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0e1728";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#3d4e73";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  ctx.fillStyle = "#d8e0f2";
  ctx.font = "14px Arial";
  ctx.fillText("Optická osa", 8, canvas.height / 2 - 8);

  const sourceXPx = xToPx(bench.sourceX);
  ctx.strokeStyle = "#7a8db5";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sourceXPx, canvas.height / 2 - 16);
  ctx.lineTo(sourceXPx, canvas.height / 2 + 16);
  ctx.stroke();

  lenses.forEach((lens) => drawLens(lens));
}

function drawLens(lens) {
  const x = xToPx(lens.x);
  const centerY = canvas.height / 2;
  const h = lensVisualHeightPx;
  const minAbsFocal = 5;
  const maxAbsFocal = 120;
  const clampedAbsFocal = Math.max(
    minAbsFocal,
    Math.min(maxAbsFocal, Math.abs(lens.focalLength))
  );
  const t = (clampedAbsFocal - minAbsFocal) / (maxAbsFocal - minAbsFocal);
  const lineWidth = 5.2 - t * 4.4;

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = lens.type === "converging" ? "#66d9ef" : "#ff7f8f";
  ctx.beginPath();
  ctx.moveTo(x, centerY - h / 2);
  ctx.lineTo(x, centerY + h / 2);
  ctx.stroke();

  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = "12px Arial";
  ctx.fillText(`${lens.id}`, x + 6, centerY - h / 2 - 8);
  ctx.fillText(`${lens.focalLength.toFixed(0)} cm`, x - 24, centerY + h / 2 + 18);

  ctx.beginPath();
  if (lens.type === "converging") {
    ctx.moveTo(x - 8, centerY - h / 2 + 10);
    ctx.lineTo(x, centerY - h / 2);
    ctx.lineTo(x + 8, centerY - h / 2 + 10);
    ctx.moveTo(x - 8, centerY + h / 2 - 10);
    ctx.lineTo(x, centerY + h / 2);
    ctx.lineTo(x + 8, centerY + h / 2 - 10);
  } else {
    ctx.moveTo(x - 8, centerY - h / 2);
    ctx.lineTo(x, centerY - h / 2 + 10);
    ctx.lineTo(x + 8, centerY - h / 2);
    ctx.moveTo(x - 8, centerY + h / 2);
    ctx.lineTo(x, centerY + h / 2 - 10);
    ctx.lineTo(x + 8, centerY + h / 2);
  }
  ctx.stroke();
}

function traceRay(ray) {
  const sorted = [...lenses].sort((a, b) => a.x - b.x);
  const points = [];
  const halfHeightCm = lensHalfHeightCm();
  let x = bench.sourceX;
  let y = ray.y;
  let theta = ray.theta;

  points.push({ x, y });

  sorted.forEach((lens) => {
    const dx = lens.x - x;
    y += theta * dx;
    x = lens.x;
    points.push({ x, y });

    if (Math.abs(y) <= halfHeightCm) {
      theta = theta - y / lens.focalLength;
    }
  });

  const dxEnd = bench.worldLengthCm - x;
  y += theta * dxEnd;
  x = bench.worldLengthCm;
  points.push({ x, y });

  return points;
}

function drawRays() {
  const rays = createRays();
  rays.forEach((ray, idx) => {
    const points = traceRay(ray);
    const hue = 15 + idx * 18;
    ctx.strokeStyle = `hsl(${hue}, 95%, 62%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, index) => {
      const px = xToPx(p.x);
      const py = yToPx(p.y);
      if (index === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();
  });
}

function drawScale() {
  ctx.strokeStyle = "#6f84b2";
  ctx.fillStyle = "#b8c7e6";
  ctx.lineWidth = 1;
  ctx.font = "12px Arial";

  for (let x = 0; x <= bench.worldLengthCm + 0.0001; x += 20) {
    const xp = xToPx(x);
    ctx.beginPath();
    ctx.moveTo(xp, canvas.height / 2 - 6);
    ctx.lineTo(xp, canvas.height / 2 + 6);
    ctx.stroke();
    ctx.fillText(`${x.toFixed(0)} cm`, xp - 18, canvas.height / 2 + 22);
  }
}

function draw() {
  drawBench();
  drawRays();
  drawScale();
}

renderLensControls();
sourceDirectionLabel.textContent = `Směr svazku: ${getDirectionText(
  source.direction
)}`;
draw();
