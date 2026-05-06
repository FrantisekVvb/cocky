const canvas = document.getElementById("benchCanvas");
const ctx = canvas.getContext("2d");

const bench = {
  worldLengthCm: 200,
  sourceX: 0,
};

const source = {
  direction: 0,
};

const lenses = [];
let lensId = 1;
/** Čočka zobrazená v panelu (klik na čočku na lavici). */
let selectedLensId = null;

const lensesContainer = document.getElementById("lensesContainer");
const addConvergingBtn = document.getElementById("addConverging");
const addDivergingBtn = document.getElementById("addDiverging");
const resetLensesBtn = document.getElementById("resetLenses");
const sourceDirectionInput = document.getElementById("sourceDirection");
const resetSourceDirectionBtn = document.getElementById("resetSourceDirection");
const fiveRaysToggleBtn = document.getElementById("fiveRaysToggle");
const benchWrapEl = document.querySelector(".benchWrap");
const benchRowEl = document.querySelector(".benchRow");
const verticalSliderWrapEl = document.querySelector(".verticalSliderWrap");
const lensFocalHudEl = document.getElementById("lensFocalHud");
const lensFocalHudInput = document.getElementById("lensFocalHudInput");
const lensFocalHudLabel = document.getElementById("lensFocalHudLabel");
const lensFocalHudRemoveBtn = document.getElementById("lensFocalHudRemoveBtn");
const uiZoom = 1.85;
const lensVisualHeightPx = Math.round(190 * uiZoom);
const lensGrabTolerancePx = Math.round(12 * uiZoom);
let dragState = null;
/** Panel ohniska pod lavicí jen po upuštění bez tažení (ne při posunu čočky). */
let showFloatingLensHud = false;
let lensPointerOrigin = null;
let lensPointerDragged = false;
const LENS_HUD_CLICK_TOLERANCE_PX = 6;
/** Zapnuto: jen základních 5 paprsků (densityFactor 1), bez doplňování hustoty. */
let forceFiveRaysMode = false;

addConvergingBtn.addEventListener("click", () => addLens("converging"));
addDivergingBtn.addEventListener("click", () => addLens("diverging"));
resetLensesBtn.addEventListener("click", () => {
  lenses.length = 0;
  selectedLensId = null;
  renderLensControls();
  draw();
});
function syncSourceDirectionUi() {
  const text = getDirectionText(source.direction);
  sourceDirectionInput.setAttribute("aria-valuetext", text);
  sourceDirectionInput.title = `Směr svazku: ${text}`;
}

sourceDirectionInput.addEventListener("input", () => {
  source.direction = Number(sourceDirectionInput.value);
  syncSourceDirectionUi();
  draw();
});
resetSourceDirectionBtn.addEventListener("click", () => {
  source.direction = 0;
  sourceDirectionInput.value = "0";
  syncSourceDirectionUi();
  draw();
});

fiveRaysToggleBtn?.addEventListener("click", () => {
  forceFiveRaysMode = !forceFiveRaysMode;
  fiveRaysToggleBtn.setAttribute("aria-pressed", String(forceFiveRaysMode));
  fiveRaysToggleBtn.classList.toggle(
    "sourceFiveRaysBtnActive",
    forceFiveRaysMode
  );
  draw();
});

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);

lensFocalHudRemoveBtn?.addEventListener("click", () => {
  const lens = getSelectedLens();
  if (!lens) return;
  const index = lenses.findIndex((l) => l.id === lens.id);
  if (index >= 0) {
    lenses.splice(index, 1);
  }
  selectedLensId = null;
  renderLensControls();
  draw();
});

lensFocalHudInput.addEventListener("input", () => {
  const lens = getSelectedLens();
  if (!lens) return;
  lens.focalLength = normalizeFocalLength(
    lens.type,
    Number(lensFocalHudInput.value)
  );
  const txt = `Ohnisková vzdálenost: ${lens.focalLength.toFixed(0)} cm`;
  lensFocalHudLabel.textContent = txt;
  lensFocalHudInput.setAttribute(
    "aria-valuetext",
    `${lens.focalLength.toFixed(0)} cm`
  );
  draw();
});

function getSelectedLens() {
  return selectedLensId !== null
    ? lenses.find((l) => l.id === selectedLensId) ?? null
    : null;
}

function positionLensFocalHud(lens) {
  if (!lensFocalHudEl || lensFocalHudEl.hidden || !lens || !canvas) return;
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  const cx = xToPx(lens.x);
  const centerY = canvas.height / 2;
  const h = lensVisualHeightPx;
  const bottomY =
    centerY + h / 2 + Math.round(22 * uiZoom) + Math.round(6 * uiZoom);
  const left = canvasRect.left + cx * scaleX;
  const top = canvasRect.top + bottomY * scaleY;
  lensFocalHudEl.style.left = `${left}px`;
  lensFocalHudEl.style.top = `${top}px`;
}

function syncLensFocalHud() {
  const lens = getSelectedLens();
  if (!lensFocalHudEl || !lensFocalHudInput || !lensFocalHudLabel) return;
  if (!lens) {
    lensFocalHudEl.hidden = true;
    showFloatingLensHud = false;
    return;
  }
  lens.focalLength = normalizeFocalLength(lens.type, lens.focalLength);
  lensFocalHudInput.min = String(lens.type === "converging" ? 5 : -120);
  lensFocalHudInput.max = String(lens.type === "converging" ? 120 : -5);
  lensFocalHudInput.value = String(lens.focalLength);
  const txt = `Ohnisková vzdálenost: ${lens.focalLength.toFixed(0)} cm`;
  lensFocalHudLabel.textContent = txt;
  lensFocalHudInput.setAttribute(
    "aria-valuetext",
    `${lens.focalLength.toFixed(0)} cm`
  );
  lensFocalHudInput.setAttribute(
    "aria-label",
    "Ohnisková vzdálenost aktivní čočky"
  );
  lensFocalHudEl.hidden = !showFloatingLensHud;
  if (!lensFocalHudEl.hidden) {
    positionLensFocalHud(lens);
  }
}

function addLens(type) {
  const id = lensId++;
  lenses.push({
    id,
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

  if (
    selectedLensId !== null &&
    !lenses.some((l) => l.id === selectedLensId)
  ) {
    selectedLensId = null;
  }

  if (selectedLensId === null) {
    syncLensFocalHud();
    return;
  }

  const lens = lenses.find((l) => l.id === selectedLensId);
  if (!lens) {
    selectedLensId = null;
    syncLensFocalHud();
    return;
  }

  lens.focalLength = normalizeFocalLength(lens.type, lens.focalLength);
  syncLensFocalHud();
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

/** y na konci lavice při přímém šíření bez čoček — počet paprsků podle něj závisí jen na směru svazku, ne na čočkách. */
function yAtBenchEndWithoutLenses(ray) {
  const dx = bench.worldLengthCm - bench.sourceX;
  return ray.y + ray.theta * dx;
}

function rayPassesVirtualApertureStraight(ray) {
  return Math.abs(yAtBenchEndWithoutLenses(ray)) <= lensHalfHeightCm();
}

function createRays() {
  const minThroughEnd = 5;
  const outerSlotIndex = 2;
  const baseSpacingCm = 7 * uiZoom;
  const xRefCm = 40;
  const dxRef = Math.max(0.0001, xRefCm - bench.sourceX);
  const anglePerIndex = 0.09;
  const maxDensityFactor = 48;

  function divergingRaysForDensity(densityFactor) {
    const spacing = baseSpacingCm / densityFactor;
    const maxIdx = outerSlotIndex * densityFactor;
    const t = Math.min(1, Math.max(0, -source.direction));
    const rays = [];
    for (let index = -maxIdx; index <= maxIdx; index += 1) {
      const yRef = index * spacing;
      const yAtSource = yRef * (1 - t);
      const theta = (yRef - yAtSource) / dxRef;
      rays.push({ y: yAtSource, theta });
    }
    return rays;
  }

  function convergingOrParallelRaysForDensity(densityFactor) {
    const spacing = baseSpacingCm / densityFactor;
    const maxIdx = outerSlotIndex * densityFactor;
    const angleScale = anglePerIndex / densityFactor;
    const rays = [];
    for (let index = -maxIdx; index <= maxIdx; index += 1) {
      rays.push({
        y: index * spacing,
        theta: -source.direction * index * angleScale,
      });
    }
    return rays;
  }

  let densityFactor = 1;
  let rays =
    source.direction < 0
      ? divergingRaysForDensity(densityFactor)
      : convergingOrParallelRaysForDensity(densityFactor);

  if (!forceFiveRaysMode) {
    while (
      rays.filter(rayPassesVirtualApertureStraight).length < minThroughEnd &&
      densityFactor < maxDensityFactor
    ) {
      densityFactor += 1;
      rays =
        source.direction < 0
          ? divergingRaysForDensity(densityFactor)
          : convergingOrParallelRaysForDensity(densityFactor);
    }
  }

  return rays;
}

function xToPx(x) {
  return (x / bench.worldLengthCm) * canvas.width;
}

function pxToX(px) {
  return (px / canvas.width) * bench.worldLengthCm;
}

function yToPx(y) {
  return canvas.height * 0.5 - y * (3.2 * uiZoom);
}

function lensHalfHeightCm() {
  return (lensVisualHeightPx / 2) / (3.2 * uiZoom);
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
    lensPointerOrigin = null;
    lensPointerDragged = false;
    showFloatingLensHud = false;
    if (selectedLensId !== null) {
      selectedLensId = null;
      renderLensControls();
    }
    draw();
    return;
  }
  const alreadySelected = selectedLensId === lens.id;
  selectedLensId = lens.id;
  lensPointerOrigin = { x: event.clientX, y: event.clientY };
  lensPointerDragged = false;
  if (!alreadySelected) {
    showFloatingLensHud = false;
  }
  renderLensControls();
  canvas.setPointerCapture(event.pointerId);
  dragState = {
    lensId: lens.id,
    pointerId: event.pointerId,
  };
  canvas.style.cursor = "grabbing";
  draw();
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
    if (lensPointerOrigin) {
      const dx = event.clientX - lensPointerOrigin.x;
      const dy = event.clientY - lensPointerOrigin.y;
      if (
        dx * dx + dy * dy >
        LENS_HUD_CLICK_TOLERANCE_PX * LENS_HUD_CLICK_TOLERANCE_PX
      ) {
        lensPointerDragged = true;
        showFloatingLensHud = false;
        if (lensFocalHudEl) {
          lensFocalHudEl.hidden = true;
        }
      }
    }
    const minX = 20;
    const maxX = 190;
    lens.x = Math.max(minX, Math.min(maxX, pxToX(point.x)));
    lenses.sort((a, b) => a.x - b.x);
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

  if (lensPointerOrigin !== null) {
    showFloatingLensHud = !lensPointerDragged;
    lensPointerOrigin = null;
    lensPointerDragged = false;
    syncLensFocalHud();
    draw();
  }
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
  const lineWidth = (5.2 - t * 4.4) * uiZoom;

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = lens.type === "converging" ? "#66d9ef" : "#ff7f8f";
  const tipInset = Math.round(10 * uiZoom);
  ctx.beginPath();
  if (lens.type === "converging") {
    ctx.moveTo(x, centerY - h / 2);
    ctx.lineTo(x, centerY + h / 2);
  } else {
    ctx.moveTo(x, centerY - h / 2 + tipInset);
    ctx.lineTo(x, centerY + h / 2 - tipInset);
  }
  ctx.stroke();

  ctx.beginPath();
  if (lens.type === "converging") {
    ctx.moveTo(x - Math.round(8 * uiZoom), centerY - h / 2 + tipInset);
    ctx.lineTo(x, centerY - h / 2);
    ctx.lineTo(x + Math.round(8 * uiZoom), centerY - h / 2 + tipInset);
    ctx.moveTo(x - Math.round(8 * uiZoom), centerY + h / 2 - tipInset);
    ctx.lineTo(x, centerY + h / 2);
    ctx.lineTo(x + Math.round(8 * uiZoom), centerY + h / 2 - tipInset);
  } else {
    ctx.moveTo(x - Math.round(8 * uiZoom), centerY - h / 2);
    ctx.lineTo(x, centerY - h / 2 + tipInset);
    ctx.lineTo(x + Math.round(8 * uiZoom), centerY - h / 2);
    ctx.moveTo(x - Math.round(8 * uiZoom), centerY + h / 2);
    ctx.lineTo(x, centerY + h / 2 - tipInset);
    ctx.lineTo(x + Math.round(8 * uiZoom), centerY + h / 2);
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
  const hueLeft = 15;
  const hueSpan = 4 * 18;
  rays.forEach((ray, idx) => {
    const points = traceRay(ray);
    const hue =
      rays.length <= 1
        ? hueLeft + hueSpan / 2
        : hueLeft + (idx / (rays.length - 1)) * hueSpan;
    ctx.strokeStyle = `hsl(${hue}, 95%, 62%)`;
    ctx.lineWidth = 2 * uiZoom;
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
  ctx.lineWidth = 1 * uiZoom;
  ctx.font = `${Math.round(12 * uiZoom)}px Arial`;

  for (let x = 0; x <= bench.worldLengthCm + 0.0001; x += 20) {
    const xp = xToPx(x);
    ctx.beginPath();
    ctx.moveTo(xp, canvas.height / 2 - Math.round(6 * uiZoom));
    ctx.lineTo(xp, canvas.height / 2 + Math.round(6 * uiZoom));
    ctx.stroke();
    const text = `${x.toFixed(0)} cm`;
    const textWidth = ctx.measureText(text).width;
    const pad = Math.round(6 * uiZoom);
    const textX = Math.min(
      canvas.width - textWidth - pad,
      Math.max(pad, xp - textWidth / 2)
    );
    ctx.fillText(text, textX, canvas.height / 2 + Math.round(22 * uiZoom));
  }
}

function drawLensFocalLabels() {
  const centerY = canvas.height / 2;
  const h = lensVisualHeightPx;
  const y = centerY + h / 2 + Math.round(10 * uiZoom);
  ctx.save();
  ctx.font = `${Math.round(12 * uiZoom)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.round(3 * uiZoom);
  lenses.forEach((lens) => {
    const x = xToPx(lens.x);
    const text = `${lens.focalLength.toFixed(0)} cm`;
    ctx.strokeStyle = "rgba(14, 23, 40, 0.92)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = lens.type === "converging" ? "#66d9ef" : "#ff7f8f";
    ctx.fillText(text, x, y);
  });
  ctx.restore();
}

function draw() {
  drawBench();
  drawRays();
  drawScale();
  drawLensFocalLabels();
  positionLensFocalHud(getSelectedLens());
}

function fitBenchWorkspaceCanvas() {
  if (!benchWrapEl || !canvas) return;
  const cs = getComputedStyle(benchWrapEl);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availW = Math.max(1, benchWrapEl.clientWidth - padX);
  const availH = Math.max(1, benchWrapEl.clientHeight - padY);
  const cw = canvas.width;
  const ch = canvas.height;
  const scale = Math.min(availW / cw, availH / ch, 1);
  canvas.style.width = `${cw * scale}px`;
  canvas.style.height = `${ch * scale}px`;
}

function fitDirectionSliderTrack() {
  if (!verticalSliderWrapEl || !sourceDirectionInput) return;
  if (window.matchMedia("(max-width: 980px)").matches) {
    sourceDirectionInput.style.width = "";
    return;
  }
  const h = verticalSliderWrapEl.clientHeight;
  const len = Math.max(48, h - 8);
  sourceDirectionInput.style.width = `${len}px`;
}

function fitWorkspaceLayout() {
  fitBenchWorkspaceCanvas();
  fitDirectionSliderTrack();
  positionLensFocalHud(getSelectedLens());
}

if (typeof ResizeObserver !== "undefined") {
  if (benchWrapEl) {
    new ResizeObserver(fitWorkspaceLayout).observe(benchWrapEl);
  }
  if (benchRowEl) {
    new ResizeObserver(fitWorkspaceLayout).observe(benchRowEl);
  }
  if (verticalSliderWrapEl) {
    new ResizeObserver(fitWorkspaceLayout).observe(verticalSliderWrapEl);
  }
} else {
  window.addEventListener("resize", fitWorkspaceLayout);
}

window.addEventListener("orientationchange", () => {
  requestAnimationFrame(fitWorkspaceLayout);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitWorkspaceLayout);
}

renderLensControls();
syncSourceDirectionUi();
fitWorkspaceLayout();
draw();
