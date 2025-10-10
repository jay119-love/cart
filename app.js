(function () {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  // Controls
  const inputUser = document.getElementById('input-user');
  const inputCloth = document.getElementById('input-cloth');
  const rangeScale = document.getElementById('range-scale');
  const rangeRotate = document.getElementById('range-rotate');
  const btnExport = document.getElementById('btn-export');
  const btnReset = document.getElementById('btn-reset');
  const chkMirror = document.getElementById('chk-mirror');
  const bgColor = document.getElementById('bg-color');

  // State
  const state = {
    backgroundImage: null, // ImageBitmap
    clothingImage: null,   // ImageBitmap
    // clothing transform (center-based)
    clothing: {
      x: canvas.width * 0.5,
      y: canvas.height * 0.5,
      scale: 1,
      rotationDeg: 0,
      width: 0,
      height: 0,
    },
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    needRerender: true,
  };

  // HiDPI scaling
  function fitCanvasToDisplay() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const needResize = canvas.width !== Math.round(displayWidth * dpr) || canvas.height !== Math.round(displayHeight * dpr);
    if (needResize) {
      canvas.width = Math.max(1, Math.round(displayWidth * dpr));
      canvas.height = Math.max(1, Math.round(displayHeight * dpr));
      state.needRerender = true;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  // Image loading helpers
  async function loadImageFromFile(file) {
    if (!file) return null;
    const blobUrl = URL.createObjectURL(file);
    const img = await createImageBitmap(await fetch(blobUrl).then(r => r.blob()));
    URL.revokeObjectURL(blobUrl);
    return img;
  }

  function resetClothingTransform() {
    state.clothing.scale = 1;
    state.clothing.rotationDeg = 0;
    rangeScale.value = String(state.clothing.scale);
    rangeRotate.value = String(state.clothing.rotationDeg);
  }

  function autoPlaceClothing() {
    // Place near top-middle assuming portrait canvas
    state.clothing.x = canvas.width * 0.5 / (window.devicePixelRatio || 1);
    state.clothing.y = canvas.height * 0.35 / (window.devicePixelRatio || 1);
  }

  // Drawing
  function clearCanvas() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function drawBackground() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.save();
    // background fill when no photo
    ctx.fillStyle = bgColor.value || '#111';
    ctx.fillRect(0, 0, w, h);

    if (state.backgroundImage) {
      const img = state.backgroundImage;
      const imgAR = img.width / img.height;
      const canvasAR = w / h;
      let dw, dh, dx, dy;
      if (imgAR > canvasAR) {
        dh = h;
        dw = dh * imgAR;
      } else {
        dw = w;
        dh = dw / imgAR;
      }
      dx = (w - dw) / 2;
      dy = (h - dh) / 2;

      ctx.save();
      if (chkMirror.checked) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        // draw with mirrored transform
        ctx.drawImage(img, dx - w, dy, dw, dh);
      } else {
        ctx.drawImage(img, dx, dy, dw, dh);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawClothing() {
    if (!state.clothingImage) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const { x, y, scale, rotationDeg, width, height } = state.clothing;
    const img = state.clothingImage;
    const drawW = width * scale;
    const drawH = height * scale;

    ctx.save();
    // Handle mirror mode by mirroring the whole stage for consistent drag direction
    if (chkMirror.checked) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.translate(x, y);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  function render() {
    fitCanvasToDisplay();
    clearCanvas();
    drawBackground();
    drawClothing();
    state.needRerender = false;
  }

  // Interaction helpers
  function canvasPointFromEvent(evt) {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left);
    const y = (evt.clientY - rect.top);
    return { x, y };
  }

  function isPointInClothing(px, py) {
    if (!state.clothingImage) return false;
    const { x, y, scale, rotationDeg, width, height } = state.clothing;
    // Undo mirror transform for hit test when mirror is on
    const w = canvas.clientWidth;
    const mx = chkMirror.checked ? (w - px) : px;
    const my = py;

    const dx = mx - x;
    const dy = my - y;
    const rad = (-rotationDeg * Math.PI) / 180; // inverse rotation
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    const halfW = (width * scale) / 2;
    const halfH = (height * scale) / 2;
    return Math.abs(rx) <= halfW && Math.abs(ry) <= halfH;
  }

  // Events: uploads
  inputUser.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    state.backgroundImage = await loadImageFromFile(file);
    state.needRerender = true;
    render();
  });

  inputCloth.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = await loadImageFromFile(file);
    state.clothingImage = img;
    state.clothing.width = img.width;
    state.clothing.height = img.height;
    resetClothingTransform();
    autoPlaceClothing();
    state.needRerender = true;
    render();
  });

  // Events: controls
  rangeScale.addEventListener('input', () => {
    state.clothing.scale = parseFloat(rangeScale.value) || 1;
    state.needRerender = true;
    render();
  });
  rangeRotate.addEventListener('input', () => {
    state.clothing.rotationDeg = parseFloat(rangeRotate.value) || 0;
    state.needRerender = true;
    render();
  });
  chkMirror.addEventListener('change', () => { render(); });
  bgColor.addEventListener('input', () => { render(); });

  // Events: drag move
  function onPointerDown(e) {
    const p = canvasPointFromEvent(e);
    if (!isPointInClothing(p.x, p.y)) return;
    e.preventDefault();
    const w = canvas.clientWidth;
    const mx = chkMirror.checked ? (w - p.x) : p.x;
    state.isDragging = true;
    state.dragOffset.x = mx - state.clothing.x;
    state.dragOffset.y = p.y - state.clothing.y;
  }
  function onPointerMove(e) {
    if (!state.isDragging) return;
    const p = canvasPointFromEvent(e);
    const w = canvas.clientWidth;
    const mx = chkMirror.checked ? (w - p.x) : p.x;
    state.clothing.x = mx - state.dragOffset.x;
    state.clothing.y = p.y - state.dragOffset.y;
    render();
  }
  function onPointerUp() {
    state.isDragging = false;
  }

  canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (!t) return;
    onPointerDown(t);
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t) return;
    onPointerMove(t);
  }, { passive: false });
  window.addEventListener('touchend', onPointerUp);

  // Wheel scale
  canvas.addEventListener('wheel', (e) => {
    if (!state.clothingImage) return;
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.05;
    const next = Math.min(3, Math.max(0.1, state.clothing.scale + delta));
    state.clothing.scale = next;
    rangeScale.value = String(next);
    render();
  }, { passive: false });

  // Export PNG
  btnExport.addEventListener('click', () => {
    // Render at current canvas size; ensure up to date
    render();
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'virtual-fitting.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // Reset
  btnReset.addEventListener('click', () => {
    state.backgroundImage = null;
    state.clothingImage = null;
    state.clothing.width = 0;
    state.clothing.height = 0;
    resetClothingTransform();
    render();
  });

  // Resize handling
  const ro = new ResizeObserver(() => render());
  ro.observe(canvas);
  window.addEventListener('resize', () => render());

  // First paint
  render();
})();


