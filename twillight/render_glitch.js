'use strict';

// Помехи интерфейса от радиационного фона (см. world.radAt). Чисто визуальный
// пост-эффект поверх всего кадра, в ПИКСЕЛЯХ канваса. Чем выше intensity (0..1),
// тем сильнее «электроника сбоит» — вплоть до невозможности разглядеть экран
// (это часть эксплоринга: глубоко/у очага radиации картинка тонет в шуме).
// Стадии нарастают плавно и накладываются:
//   • слабо   — рой тонких строк разной высоты/скорости мерцания + лёгкое RGB-расхождение;
//   • средне  — крупные срывы строк, бегущая полоса, RGB-сдвиг, редкая «снежная» крупа;
//   • сильно  — «снег» (ТВ-помехи) густеет, блок-коррупция, рывки, вспышки;
//   • критично (≈0.85+) — экран почти целиком в снегу/срывах, читать нечего.

let _glBuf = null, _glBufX = null, _glTmp = null, _glTmpX = null, _glSnow = null, _glSnowX = null;
let _glSlow = [], _glBlocks = [], _glTick = -1, _glJolt = 0, _glFlash = 0, _glSnowTick = -1;
const _SNW = 220, _SNH = 165;   // разрешение тайла «снега» (грубоватая аналоговая крупа)

function _glEnsure(W, H) {
  if (!_glBuf || _glBuf.width !== W || _glBuf.height !== H) {
    _glBuf = document.createElement('canvas'); _glBuf.width = W; _glBuf.height = H; _glBufX = _glBuf.getContext('2d');
    _glTmp = document.createElement('canvas'); _glTmp.width = W; _glTmp.height = H; _glTmpX = _glTmp.getContext('2d');
  }
  if (!_glSnow) { _glSnow = document.createElement('canvas'); _glSnow.width = _SNW; _glSnow.height = _SNH; _glSnowX = _glSnow.getContext('2d'); }
}

// канал: снимок, затёртый до одного цвета (multiply), кладётся на ctx со сдвигом —
// сложение 'lighter' трёх каналов с разным сдвигом X даёт RGB-расхождение.
function _glChannel(ctx, color, ox, oy, W, H) {
  const x = _glTmpX;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
  x.drawImage(_glBuf, 0, 0);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, W, H);
  ctx.drawImage(_glTmp, ox, oy);
}

// перегенерация «снега»: случайная яркость по пикселям тайла (ТВ-static)
function _glRegenSnow() {
  const x = _glSnowX, img = x.createImageData(_SNW, _SNH), p = img.data;
  for (let i = 0; i < _SNW * _SNH; i++) { const g = (Math.random() * 255) | 0; const o = i * 4; p[o] = g; p[o + 1] = g; p[o + 2] = g; p[o + 3] = 255; }
  x.putImageData(img, 0, 0);
}

function drawInterference(ctx, canvas, intensity, t) {
  const I = Math.max(0, Math.min(1, intensity || 0));
  if (I < 0.03) return;
  const W = canvas.width, H = canvas.height; if (!W || !H) return;
  _glEnsure(W, H);

  // снимок чистого кадра
  _glBufX.setTransform(1, 0, 0, 1, 0, 0); _glBufX.globalCompositeOperation = 'source-over';
  _glBufX.clearRect(0, 0, W, H); _glBufX.drawImage(canvas, 0, 0);

  // медленный «глитч-такт» (~13 Гц): крупные срывы строк / блоки / рывок / вспышка
  const tick = Math.floor(t * 13);
  if (tick !== _glTick) {
    _glTick = tick;
    const nSlow = Math.floor(I * 5 + I * I * 6);             // есть и на слабом фоне (разная скорость мерцания со «снегом» строк)
    _glSlow = [];
    for (let i = 0; i < nSlow; i++) _glSlow.push({ y: Math.random() * H, h: (12 + Math.random() * 70) * (0.6 + I), off: (Math.random() - 0.5) * I * I * 200 });
    _glBlocks = [];
    const nB = I > 0.45 ? Math.floor((I - 0.45) * 2 * 20) : 0;
    for (let i = 0; i < nB; i++) _glBlocks.push({ x: Math.random() * W, y: Math.random() * H, w: 10 + Math.random() * 130, h: 2 + Math.random() * 12, on: Math.random() < 0.5 });
    _glJolt = (I > 0.4 && Math.random() < (I - 0.4) * 1.6) ? (Math.random() - 0.5) * I * 34 : 0;
    _glFlash = (I > 0.6 && Math.random() < (I - 0.6) * 1.7) ? 1 : 0;
  }
  // «снег» обновляем чаще (~28 Гц) — живая крупа, но без 60-Гц нагрузки
  const sTick = Math.floor(t * 28);
  if (sTick !== _glSnowTick) { _glSnowTick = sTick; if (I > 0.1) _glRegenSnow(); }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 1) RGB-расхождение каналов (пульсирует) + вертикальный рывок (oy).
  // Сильнее и раньше: интерфейс начинает «расщепляться» уже на слабом фоне.
  const dx = I * 16 * (0.66 + 0.34 * Math.sin(t * 7.3));
  const jx = (Math.random() - 0.5) * I * 4;
  if (dx >= 0.4) {
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    _glChannel(ctx, '#ff0000', dx + jx, _glJolt, W, H);
    _glChannel(ctx, '#00ff00', 0, _glJolt, W, H);
    _glChannel(ctx, '#0000ff', -dx + jx, _glJolt, W, H);
    ctx.globalCompositeOperation = 'source-over';
    _glBufX.clearRect(0, 0, W, H); _glBufX.drawImage(canvas, 0, 0);  // срывы пойдут уже по «расщеплённому» кадру
  }

  // 2) срывы строк: КРУПНЫЕ медленные полосы + рой ТОНКИХ быстрых (разной высоты/скорости).
  // Часть полос смещаем в ВЕРХНЮЮ зону (там HUD/виджет) — чтобы интерфейс рвало рано.
  ctx.globalCompositeOperation = 'source-over';
  const hudH = H * 0.26;                                   // верхняя полоса с интерфейсом
  for (const s of _glSlow) ctx.drawImage(_glBuf, 0, s.y, W, s.h, s.off, s.y, W, s.h);
  const nThin = Math.floor(6 + I * 20);                    // даже на слабом фоне — рой строк
  for (let i = 0; i < nThin; i++) {
    const h = 1 + Math.random() * (2 + I * 8);
    const y = Math.random() < 0.45 ? Math.random() * hudH : Math.random() * H;  // ~45% бьют по интерфейсу
    const off = (Math.random() - 0.5) * (10 + I * 90);     // заметнее на слабом фоне
    ctx.drawImage(_glBuf, 0, y, W, h, off, y, W, h);
  }

  // 3) блок-коррупция (датамош): крупные куски кадра прыгают (сильный фон)
  if (I > 0.6) {
    const n = Math.floor((I - 0.6) * 2.5 * 9);
    for (let i = 0; i < n; i++) {
      const bw = W * (0.12 + Math.random() * 0.55), bh = 10 + Math.random() * 80;
      const sx = Math.random() * (W - bw), sy = Math.random() * (H - bh);
      ctx.drawImage(_glBuf, sx, sy, bw, bh, Math.random() * (W - bw), sy + (Math.random() - 0.5) * 50, bw, bh);
    }
  }

  // 4) бегущая полоса синхронизации
  const barY = (t * (40 + 160 * I)) % (H + 80) - 40, barH = 24 + 100 * I;
  const bg = ctx.createLinearGradient(0, barY, 0, barY + barH);
  bg.addColorStop(0, 'rgba(180,220,255,0)'); bg.addColorStop(0.5, `rgba(190,225,255,${0.05 + 0.17 * I})`); bg.addColorStop(1, 'rgba(180,220,255,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = bg; ctx.fillRect(0, barY, W, barH);

  // 5) скан-полосы
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.05 + 0.14 * I; ctx.fillStyle = '#04050a';
  for (let y = (tick % 3); y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.globalAlpha = 1;

  // 6) цифровой шум-блоки
  for (const b of _glBlocks) { ctx.fillStyle = b.on ? 'rgba(230,240,255,0.55)' : 'rgba(3,4,8,0.78)'; ctx.fillRect(b.x, b.y, b.w, b.h); }

  // 7) «СНЕГ» (ТВ-помехи радиации) — на слабом фоне почти нет, к высокому густеет.
  // Затирающих проходов НЕСКОЛЬКО (со случайным сдвигом каждый) — тёмные пиксели
  // одного прохода перекрываются яркими другого, поэтому даже ЯРКИЙ интерфейс тонет
  // (раньше светлые панели «просвечивали» сквозь один проход). Онсет с ~0.32.
  // Среднее — читаемо (один проход), но к ПИКУ проходов несколько (со случайным
  // сдвигом): тёмные пиксели одного перекрываются яркими другого, поэтому у источника
  // даже ЯРКИЙ интерфейс ПОЛНОСТЬЮ тонет (раньше панели «просвечивали»).
  const snowA = Math.max(0, (I - 0.42) / 0.58);
  if (snowA > 0.001) {
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    const passes = 1 + Math.floor(Math.pow(snowA, 1.5) * 2.5);   // 1 … 3 проходов
    const a = Math.min(0.92, Math.pow(snowA, 1.3) * 0.95);
    for (let pp = 0; pp < passes; pp++) {
      ctx.globalAlpha = a;
      const ox = (Math.random() * 18) | 0, oy = (Math.random() * 18) | 0;
      ctx.drawImage(_glSnow, 0, 0, _SNW, _SNH, -ox, -oy, W + 18, H + 18);
    }
    // искрящаяся крупа сверху (аддитивно, умеренно — иначе бьёт по тёмному фону)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.15 * snowA;
    ctx.drawImage(_glSnow, 0, 0, _SNW, _SNH, 6, 4, W + 18, H + 18);
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = sm;
  }

  // 8) болезненный зелёный отлив радиации (слабый, на среднем+ фоне) + срыв-вспышка
  if (I > 0.5) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(120,200,90,${(I - 0.5) * 0.08})`; ctx.fillRect(0, 0, W, H); }
  if (_glFlash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(150,60,40,${0.12 + 0.14 * Math.random()})`; ctx.fillRect(0, 0, W, H); }

  ctx.restore();
}
