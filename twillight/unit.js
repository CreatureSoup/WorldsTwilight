'use strict';

// Unit — грид-стейт-машина. Паук-бур: цепляется за соседнюю породу (клинг),
// статы из выбранных модулей. Бурение ПРЕРЫВАЕМО: повреждение копится на тайле
// (`tile.dig`) и сохраняется — можно бросить и продолжить позже.
// Энергии/расхода нет: упрощённая модель (см. CLAUDE.md §«Сборка»).
class Unit {
  constructor(x, y, stats) {
    this._resetRunState(x, y);
    this.setStats(stats);
  }
  // ЕДИНЫЙ сброс забег-состояния — используют И конструктор, И respawn (print_life). ⚠️ НЕ дублировать
  // список полей в respawn вручную: ручное зеркало уже дрейфовало (drillX/dashDir/xrayR не сбрасывались) —
  // audit_2026-08. Новое поле забега — ДОБАВЛЯТЬ СЮДА, тогда respawn подхватит автоматически.
  _resetRunState(x, y) {
    this.tileX = x; this.tileY = y;
    this.px = x * TILE + TILE / 2;
    this.py = y * TILE + TILE / 2;
    this.state = IDLE;
    this.dx = 1; this.dy = 0;
    this.faceX = 1;   // последний ГОРИЗОНТАЛЬНЫЙ взгляд (тело рисуется горизонтально, флип L/R)
    this._ringAim = 0;   // угол доворота кластера кольца (см. render_ring.updateRingAim); старт = горизонт (dy=0)
    this.fromX = x; this.fromY = y; this.toX = x; this.toY = y;
    this.moveSpeed = 4; this.progress = 0;
    this.drilling = false; this.drillX = 0; this.drillY = 0;
    this.drillHeat = 0; this.drillOverheatT = 0;   // ФОРСАЖ БУРА (реликт): нагрев 0..1 + лок-кулдаун перегрева (тикает game.updateDrillOverdrive)
    this.dashing = false; this.dashDir = 1; this.dashRemain = 0; this.dashSpeed = DASH_SPEED;   // РЫВОК/ГАРПУН (реликты): авто-проходка по воздуху (updateDash/updateHarpoon запускают, _dashStep ведёт; скорость — dashSpeed)
    this.xrayR = 0;   // РЕНТГЕН (реликт): текущий радиус вскрытия тумана (тайлов, 0 = выкл); ставит game.updateXray, читает render_light.drawFog
    this.kinRamp = 0; this.kinDir = null; this.kinIdleT = 0;   // КИНЕТИЧЕСКИЙ бур: разгон ПО ВРЕМЕНИ (0..1) + направление бурения + таймер простоя
    this.dug = null; // событие «выкопан ресурсный тайл» для оркестратора (game)
    this.kinCharged = false; // ВЗРЫВНОЙ ПРОБОЙ (mast_dk_burst): суперзаряд праймлен — СЛЕДУЮЩАЯ тычка по породе мгновенна
    this.kinBurstFx = null;  // {x,y}: тайл, пробитый суперзарядом → game рисует FX
    this.echoBreak = null;   // {x,y,type,amount}: соседний тайл, пробитый ЭХО-БУРОМ → game: лут+проходка+FX
    this.webT = 0;           // ДЕБАФФ паутина (останок-робот): >0 → замедление движения (×WEB_SLOW), спадает по таймеру
    this.latchTiles = 0;     // ДЕБАФФ прыгун (останок-робот): >0 → бурение ×LATCH_DRILL_SLOW; сброс по проходке (latchTiles) ИЛИ по времени (latchT) — game считает
    this.latchT = 0;         // таймер авто-отвала прыгуна (LATCH_TIME) — чтобы не висел вечно при простое бура
    this.overshield = 0; this.overshieldDelay = 0;   // РЕЛИКТ энергощит: буфер-овершилд + задержка до регена
    this.absorbCharges = 0; this.absorbCd = 0;       // РЕЛИКТ поглощение: заряды (первые удары в ноль) + КД восстановления
    this.broke = false; // событие «прокопан ЛЮБОЙ тайл» (game считает проходку)
    this.crouchT = 0; this.crouchTarget = null; // присед перед прыжком вверх (ощущение веса)
    this._jumpDesc = false; this._jumpDescDir = 0; this._jumpDescH = 0;   // СНИЖЕНИЕ прыжка: ОТДЕЛЬНЫЙ симметричный ход вниз-вбок после апекса (dir + высота)
    this._jumpBufT = 0;                                                    // буфер нажатия «вверх»
    this.rappel = null;      // РАПЕЛЬ «Спрута»: {hx,hy} точка схода троса (unit._rappelHold)
    this.frozenPrint = this.frozenImpulse = this.frozenHack = this.frozenSiege = false;
    this.stealthT = 0;   // СТЕЛС: >0 → юнит невидим для боевых врагов (stealth.js пишет, ai.js читает)
  }
  setStats(stats) {
    const prevMax = this.stats ? this.stats.maxHp : null;
    this.stats = stats;
    if (this.hp === undefined) this.hp = stats.maxHp;
    else if (prevMax != null && stats.maxHp > prevMax) this.hp += stats.maxHp - prevMax;  // апгрейд корпуса лечит НА ПРИБАВКУ (не полностью)
    this.hp = Math.min(this.hp, stats.maxHp);
  }
  // print_life «Резервное тело»: тело печатается заново — полный сброс грид-стейта на старт через
  // ОБЩИЙ _resetRunState (тот же, что в конструкторе — списки полей не могут разъехаться), HP полный.
  respawn(x, y) {
    this._resetRunState(x, y);
    this.hp = this.stats.maxHp;
  }
  // опора: только соседняя порода (клинг). Никаких «искусственных» полов —
  // пол стартовой пещеры держится за породу под ним (гарантируется генерацией).
  anchoredAt(world, x, y) {
    if (isSolid(world.tileAt(x - 1, y)) || isSolid(world.tileAt(x + 1, y))
        || isSolid(world.tileAt(x, y - 1)) || isSolid(world.tileAt(x, y + 1))) return true;
    // «СПРУТ» — ЯКОРНЫЙ МОСТ: щупальца держат за НИЖНИЕ КРОМКИ (solid снизу-вбок, над которым ВОЗДУХ —
    // верх пола, не отвесная стена) с ОБЕИХ сторон в пределах 3 тайлов → дыры в полу шириной ≤3 проходятся
    // ЦЕЛИКОМ. Отвесные стены кромкой НЕ считаются (иначе «распорка»-вис в шахтах — отвергнуто как вис).
    // Широкая полость/дыра ≥5 не держит. Только корпус anchorLegs.
    const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[this.hull];
    if (!def || !def.anchorLegs) return false;
    const s = (dx, dy) => isSolid(world.tileAt(x + dx, y + dy));
    const edge = (sg) => { for (let k = 1; k <= 3; k++) if (s(sg * k, 1) && !s(sg * k, 0)) return true; return false; };
    return edge(-1) && edge(1);
  }
  // «СПРУТ» — РАПЕЛЬ: трос держит, пока юнит В ТОЙ ЖЕ КОЛОННЕ не глубже SPRUT_RAPPEL_LEN от точки схода,
  // а у точки схода (кромки) ещё есть порода. Невалиден → обычная гравитация (unit.update).
  _rappelHold(world) {
    const r = this.rappel; if (!r) return false;
    const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[this.hull];
    if (!def || !def.anchorLegs) return false;
    if (wrapX(this.tileX) !== wrapX(r.hx)) { this.rappel = null; return false; }          // сошёл с колонны
    const depth = this.tileY - r.hy;
    if (depth < 0 || depth > SPRUT_RAPPEL_LEN) { this.rappel = null; return false; }      // выше подвеса/трос кончился
    if (!this.anchoredAt(world, r.hx, r.hy)) { this.rappel = null; return false; }        // кромку подвеса выкопали/осыпало
    return true;
  }
  isAnchored(world) { return this.anchoredAt(world, this.tileX, this.tileY); }
  // Скорость хода — напрямую от модуля «Двигатель». Замедления от веса нет.
  effectiveSpeed() { return this.stats.moveSpeed * (this.webT > 0 ? WEB_SLOW : 1); }   // паутина-останок: замедление движения
  // ЕДИНАЯ точка урона по юниту (реликты защиты применяются ТУТ → работают со ВСЕМИ источниками урона).
  // Порядок: ШИПЫ (контактному врагу назад) → ПОГЛОЩЕНИЕ (удар в ноль) → БРОНЕПЛАСТИНЫ (−%) → ЭНЕРГОЩИТ (буфер) → hp.
  hurt(amount, src) {
    if (amount <= 0 || this.hp <= 0) return 0;
    const s = this.stats;
    if (src && s && s.thorns && typeof src.damage === 'function' && !src.dying && !src.dead) src.damage(s.thornsDmg || THORNS_DMG);   // урон ответки скалируется город-апгрейдом (s.thornsDmg)
    if (this.absorbCharges > 0) { this.absorbCharges--; if (this.absorbCharges <= 0) this.absorbCd = (s && s.absorbCd) || ABSORB_CD; return 0; }
    if (s && s.armorMult) amount *= (1 - s.armorMult);
    if (this.overshield > 0) { const a = Math.min(this.overshield, amount); this.overshield -= a; amount -= a; }
    this.overshieldDelay = OVERSHIELD_REGEN_DELAY;
    this.hp = Math.max(0, this.hp - amount);
    return amount;
  }
  startMove(toX, toY, speed) {
    this.fromX = this.tileX; this.fromY = this.tileY;
    this.toX = toX; this.toY = toY;
    this.moveSpeed = speed; this.progress = 0;
    this.state = MOVING;
  }

  // ПРЫЖКОВЫЕ ДВИЖКИ (jets.js ставит this.flying): полёт по ВОЗДУХУ в любую сторону по WASD, БЕЗ анкера и гравитации.
  // Тайл-шаговая модель как у обычного хода (startMove→MOVING), но без падения/копа: в породу не летим (только AIR).
  _flyStep(dt, input, world) {
    this.drilling = false; this._dugBlock = null;
    if (this.state === MOVING) {                       // докручиваем текущий тайл полёта
      this.progress += this.moveSpeed * dt;
      if (this.progress >= 1) {
        this.tileX = wrapX(this.toX); this.tileY = this.toY;
        this.px = this.tileX * TILE + TILE / 2; this.py = this.tileY * TILE + TILE / 2;
        this.state = IDLE; this.progress = 0;
      } else {
        const fx = this.fromX * TILE + TILE / 2, fy = this.fromY * TILE + TILE / 2;
        const tx = this.toX * TILE + TILE / 2, ty = this.toY * TILE + TILE / 2;
        this.px = fx + (tx - fx) * this.progress; this.py = fy + (ty - fy) * this.progress;
        return;
      }
    }
    let dx = 0, dy = 0;
    if (input.left()) dx = -1; else if (input.right()) dx = 1;
    if (input.up()) dy = -1; else if (input.down()) dy = 1;
    if (dx) this.faceX = dx;
    if (dx === 0 && dy === 0) return;                  // парение на месте (топливо всё равно тратится — jets.js)
    const air = (tx, ty) => ty >= 0 && ty < MAP_H && world.tileAt(tx, ty).type === AIR;   // только сквозь воздух (в породу не летим)
    if (dx && dy && air(this.tileX + dx, this.tileY + dy)) { this.dx = dx; this.dy = dy; this.startMove(this.tileX + dx, this.tileY + dy, FLY_SPEED); return; }
    if (dx && air(this.tileX + dx, this.tileY)) { this.dx = dx; this.dy = 0; this.startMove(this.tileX + dx, this.tileY, FLY_SPEED); return; }
    if (dy && air(this.tileX, this.tileY + dy)) { this.dx = 0; this.dy = dy; this.startMove(this.tileX, this.tileY + dy, FLY_SPEED); return; }
  }
  // РЫВОК (artifacts_active.js ставит this.dashing/dashDir/dashRemain): быстрая тайл-шаговая проходка ПО ВОЗДУХУ в
  // зафиксированную сторону (faceX). Породу НЕ пробивает — упёрся → стоп (зацеп/гравитация в обычном update). Без ввода/гравитации.
  _dashStep(dt, world) {
    this.drilling = false; this._dugBlock = null;
    if (this.state === MOVING) {                        // докручиваем текущий тайл рывка
      this.progress += this.moveSpeed * dt;
      if (this.progress >= 1) {
        this.tileX = wrapX(this.toX); this.tileY = this.toY;
        this.px = this.tileX * TILE + TILE / 2; this.py = this.tileY * TILE + TILE / 2;
        this.state = IDLE; this.progress = 0;
      } else {
        const fx = this.fromX * TILE + TILE / 2, fy = this.fromY * TILE + TILE / 2;
        const tx = this.toX * TILE + TILE / 2, ty = this.toY * TILE + TILE / 2;
        this.px = fx + (tx - fx) * this.progress; this.py = fy + (ty - fy) * this.progress; return;
      }
    }
    if (this.dashRemain <= 0) { this.dashing = false; return; }   // исчерпали дистанцию → стоп
    const nx = wrapX(this.tileX + this.dashDir);
    if (this.tileY >= 0 && this.tileY < MAP_H && world.tileAt(nx, this.tileY).type === AIR) {
      this.dx = this.dashDir; this.dy = 0; this.dashRemain--;
      this.startMove(this.tileX + this.dashDir, this.tileY, this.dashSpeed || DASH_SPEED);
    } else this.dashing = false;                        // впереди порода → стоп (зацеп/падение решит обычный апдейт)
  }

  // Толчок (валуном): мгновенно перенести юнита в клетку (nx,ny), сбросив движение/бур.
  shove(nx, ny) {
    this.tileX = nx; this.tileY = ny;
    this.px = nx * TILE + TILE / 2; this.py = ny * TILE + TILE / 2;
    this.fromX = nx; this.fromY = ny; this.toX = nx; this.toY = ny;
    this.progress = 0; this.state = IDLE; this._dugBlock = null;
    this.kinRamp = 0; this.kinDir = null; this.kinIdleT = 0;   // толчок сбивает кинетический разгон
  }
  update(dt, input, world) {
    const s = this.stats;
    this.drilling = false;
    if (this.webT > 0) this.webT = Math.max(0, this.webT - dt);   // ДЕБАФФ паутина (останок-робот): спад по таймеру → замедление снимается
    if (s.overshieldMax) { if (this.overshieldDelay > 0) this.overshieldDelay -= dt; else if (this.overshield < s.overshieldMax) this.overshield = Math.min(s.overshieldMax, this.overshield + OVERSHIELD_REGEN * dt); }   // РЕЛИКТ энергощит: реген после задержки без урона
    if (s.absorbMax && this.absorbCharges <= 0) { this.absorbCd -= dt; if (this.absorbCd <= 0) this.absorbCharges = s.absorbMax; }   // РЕЛИКТ поглощение: восстановление зарядов по КД
    if (this.frozenPrint) return;   // ПЕЧАТЬ: юнит залочен на месте (ввод/гравитация/бур выкл) — см. print.js
    if (this.frozenImpulse) return; // ИМПУЛЬСНЫЙ БУР: юнит стоит, пока копит заряд (аим/выстрел — impulse.js)
    if (this.frozenHack) return;    // ВЗЛОМ: юнит стоит у сердца города, пока держит канал взлома (hack.js)
    if (this.frozenSiege) return;   // ОСАДНЫЙ МОДУЛЬ: юнит стоит, пока копит заряд разряда (siege.js)
    if (this.flying) { this._flyStep(dt, input, world); return; }   // ПРЫЖКОВЫЕ ДВИЖКИ (jets.js): полёт через воздух без анкера/гравитации
    if (this.dashing) { this._dashStep(dt, world); return; }        // РЫВОК (реликт): авто-проходка по воздуху по взгляду (без ввода/гравитации)

    if (this.dx === 1 || this.dx === -1) this.faceX = this.dx;  // запомнить горизонталь до возможной смены на «вверх/вниз»

    // БУФЕР ПРЫЖКА: нажатие «вверх» помним. ⚠️ В ВОЗДУХЕ/во время прыжка буфер НЕ истекает (держится до приземления) → нажатие
    // в полёте не теряется, прыжок срабатывает сразу как встал на опору — нет «пропусков»/ощущения кулдауна при частых нажатиях.
    if (input.pressed('KeyW', 'ArrowUp')) this._jumpBufT = JUMP_BUFFER;
    else if (this._jumpBufT > 0 && this.state === IDLE && this.crouchT <= 0 && this.isAnchored(world)) this._jumpBufT = Math.max(0, this._jumpBufT - dt);
    const wantUp = input.up() || this._jumpBufT > 0;

    // КИНЕТИЧЕСКИЙ разгон копится ПО ВРЕМЕНИ бурения В ОДНУ СТОРОНУ (см. drill-блок). СБРОС: отпустил направление,
    // ИЛИ перестал бить породу дольше KIN_GRACE (стоп/пустота), ИЛИ СМЕНИЛ направление (там же в drill-блоке).
    // `kinIdleT` копит время с последнего бурения (drill-блок его обнуляет → пауза между тайлами разгон держит).
    if (s.kinetic) {
      this.kinIdleT += dt;
      if (!(input.up() || input.down() || input.left() || input.right()) || this.kinIdleT > KIN_GRACE) { this.kinRamp = 0; this.kinDir = null; this.kinCharged = false; }
    }

    // «Замок» свежепрокопанного тайла: разовое нажатие (пробил → отпустил) НЕ въезжает в дыру —
    // юнит стоит. Тем же УДЕРЖАНИЕМ заходит лишь спустя `DRILL_HOLD_ADVANCE` (непрерывный тоннель).
    // Снимается при отпускании направления (следующее нажатие — свежее).
    if (this._dugBlock) {
      if (!(input.up() || input.down() || input.left() || input.right())) this._dugBlock = null;
      else this._dugBlockT += dt;
    }

    if (this.state === MOVING) {
      this.progress += this.moveSpeed * dt;
      // НЕПРЕРЫВНОЕ ПАДЕНИЕ: при завершении тайла, если всё ещё свободное падение (нет опоры, снизу
      // воздух), сразу цепляем следующий тайл, ПЕРЕНОСЯ остаток progress — без кадра-заморозки на стыке.
      // Иначе py замирал на тайл-границе (1 кадр) → скачок скорости → ложный «удар» squash на КАЖДОМ
      // тайле (дёргано). Чейн только для падения (moveSpeed===FALL_SPEED); обычный ход — как было.
      while (this.progress >= 1) {
        this.tileX = wrapX(this.toX); this.tileY = this.toY; // переход через шов мира
        this.px = this.tileX * TILE + TILE / 2;
        this.py = this.tileY * TILE + TILE / 2;
        const falling = this.moveSpeed === FALL_SPEED && !this.isAnchored(world) && world.tileAt(this.tileX, this.tileY + 1).type === AIR && !this._rappelHold(world);
        // ПЛАВНЫЙ ход: держишь то же горизонт. направление и впереди ОТКРЫТЫЙ тайл с опорой — цепляем следующий (без «осечек по тайлам»).
        // ⚠️ но если ХОЧЕШЬ ВВЕРХ (wantUp — держишь/буфер) → НЕ продолжаем шаг: прерываемся в IDLE, чтобы поймался прыжок.
        const nx = this.tileX + this.dx;
        const walkOn = !falling && !wantUp && this.dy === 0 && (this.dx === 1 || this.dx === -1) && this.moveSpeed !== FALL_SPEED
          && (this.dx === 1 ? input.right() : input.left())
          && world.tileAt(nx, this.tileY).type === AIR && this.anchoredAt(world, nx, this.tileY)
          && !(this._dugBlock && this._dugBlock.x === wrapX(nx) && this._dugBlock.y === this.tileY);
        if (falling) { this.fromX = this.tileX; this.fromY = this.tileY; this.toX = this.tileX; this.toY = this.tileY + 1; this.progress -= 1; }
        else if (walkOn) { this.fromX = this.tileX; this.fromY = this.tileY; this.toX = nx; this.toY = this.tileY; this.progress -= 1; }
        else { this.state = IDLE; this.progress = 0; break; }
      }
      if (this.state === MOVING) {
        const fx = this.fromX * TILE + TILE / 2, fy = this.fromY * TILE + TILE / 2;
        const tx = this.toX * TILE + TILE / 2, ty = this.toY * TILE + TILE / 2;
        this.px = fx + (tx - fx) * this.progress;
        this.py = fy + (ty - fy) * this.progress;
      }
      return;
    }

    // присед перед прыжком: стоим JUMP_CROUCH_T, затем прыгаем (замедленно — тяжесть)
    if (this.crouchT > 0) {
      this.crouchT -= dt;
      if (this.crouchT <= 0 && this.crouchTarget) {
        const [jx, jy] = this.crouchTarget; this.crouchTarget = null;
        this.startMove(jx, jy, this.effectiveSpeed() * JUMP_SPEED_FRAC);
      }
      return;
    }

    // Любой ход/лазанье — только с ОПОРЫ (клинг к породе). В свободном падении
    // управление не действует: зажатые клавиши отделены от физики (гравитации),
    // поэтому «полетать» вбок по воздуху нельзя.
    const anchored = this.isAnchored(world);
    if (anchored) { this._jumpDesc = false; this._jumpDescDir = 0; this._jumpDescH = 0; this.rappel = null; }   // приземлился/зацепился → снижение прыжка отменяется, трос рапеля сматывается

    // СНИЖЕНИЕ ПРЫЖКА: апекс достигнут (ascent-ход завершён, юнит в IDLE и без опоры) → ОДИН диагональный ход вниз-вбок
    // ТОЙ ЖЕ высоты и скоростью, что подъём (арка симметрична: вверх+вбок → вниз+вбок). Путь занят → обычная гравитация ниже (быстро).
    if (this._jumpDesc && !anchored) {
      const dir = this._jumpDescDir, jh = this._jumpDescH, landX = this.tileX + dir, landY = this.tileY + jh;
      this._jumpDesc = false;
      let clear = world.tileAt(landX, landY).type === AIR && world.tileAt(this.tileX + dir, this.tileY + 1).type === AIR;
      for (let k = 2; k <= jh && clear; k++) if (world.tileAt(landX, this.tileY + k).type !== AIR) clear = false;
      if (clear) { this.dx = dir; this.dy = 1; this.startMove(landX, landY, this.effectiveSpeed() * JUMP_SPEED_FRAC); return; }
    }

    // РАПЕЛЬ «Спрута» — управление ВИСОМ на тросе (юнит в воздухе, гравитация подавлена _rappelHold):
    // S — стравить трос ниже (до SPRUT_RAPPEL_LEN, скорость юнита); W — подтянуться к подвесу; A/D — сойти
    // на соседнюю опору (кромку), если она есть; без ввода — висит. Трос рвётся сам в _rappelHold.
    if (!anchored && s.canMove && this._rappelHold(world)) {
      if (input.down() && (this.tileY - this.rappel.hy) < SPRUT_RAPPEL_LEN && world.tileAt(this.tileX, this.tileY + 1).type === AIR) {
        this.dx = 0; this.dy = 1; this.startMove(this.tileX, this.tileY + 1, this.effectiveSpeed()); return;
      }
      if (input.up() && world.tileAt(this.tileX, this.tileY - 1).type === AIR) {
        this.dx = 0; this.dy = -1; this.startMove(this.tileX, this.tileY - 1, this.effectiveSpeed()); return;
      }
      const sdx = input.left() ? -1 : input.right() ? 1 : 0;
      if (sdx !== 0 && world.tileAt(this.tileX + sdx, this.tileY).type === AIR && this.anchoredAt(world, this.tileX + sdx, this.tileY)) {
        this.rappel = null;   // сошёл с троса на кромку/мост
        this.dx = sdx; this.dy = 0; this.startMove(this.tileX + sdx, this.tileY, this.effectiveSpeed()); return;
      }
      return;   // висим на тросе
    }

    // ПОДЪЁМ по «вверх»: смарт-климб на уступ / лазанье по шахте / прыжок.
    // Присед-прыжок — ТОЛЬКО когда прыгаем в открытый воздух; лазанье с опорой — без приседа.
    if (anchored && s.canMove && wantUp) {
      const reqHx = input.left() ? -1 : input.right() ? 1 : 0;
      // 1) явный «вверх+вбок» (reqHx читает право/лево дёшево): диагональ вверх ОТКРЫТА → ДИАГОНАЛЬНЫЙ ПРЫЖОК (присед+арка+ИНЕРЦИЯ),
      //    НЕЗАВИСИМО от опоры уступа (так надёжно ловится); потолок над головой занят, а вбок открыто → шаг-залаз на уступ.
      if (reqHx !== 0) {
        const sideUpAir = world.tileAt(this.tileX + reqHx, this.tileY - 1).type === AIR;
        const upAir = world.tileAt(this.tileX, this.tileY - 1).type === AIR;
        if (sideUpAir && upAir) {
          this.dx = reqHx; this.dy = -1;
          const jh = (typeof metaHas === 'function' && metaHas('print_jump') && world.tileAt(this.tileX + reqHx, this.tileY - 2).type === AIR && world.tileAt(this.tileX, this.tileY - 2).type === AIR) ? 2 : 1;
          this.crouchT = JUMP_CROUCH_T; this.crouchTarget = [this.tileX + reqHx, this.tileY - jh];
          this._jumpDesc = true; this._jumpDescDir = reqHx; this._jumpDescH = jh; this._jumpBufT = 0;   // после апекса — зеркальный ход вниз-вбок (симметрия скорости/высоты/сноса); буфер израсходован
          return;
        }
        if (sideUpAir) { this.dx = reqHx; this.dy = 0; this.startMove(this.tileX + reqHx, this.tileY - 1, this.effectiveSpeed()); return; }   // потолок занят → шаг-залаз на уступ
      }
      // 2) «вверх» в воздух без явного вбок
      if (reqHx === 0 && world.tileAt(this.tileX, this.tileY - 1).type === AIR) {
        if (this.anchoredAt(world, this.tileX, this.tileY - 1)) {            // наверху есть опора (шахта/стена) → лезем
          this.dx = 0; this.dy = -1;
          this.startMove(this.tileX, this.tileY - 1, this.effectiveSpeed());
          return;
        }
        // прямо вверх не зацепиться → авто-цепляние за ЕДИНСТВЕННЫЙ боковой уступ (без чёткого «вбок»)
        const ledges = [];
        for (const sgn of [-1, 1])
          if (world.tileAt(this.tileX + sgn, this.tileY - 1).type === AIR && this.anchoredAt(world, this.tileX + sgn, this.tileY - 1)) ledges.push(sgn);
        const side = ledges.length === 1 ? ledges[0] : (ledges.length === 2 && ledges.includes(this.dx) ? this.dx : null);
        if (side !== null) {
          this.dx = side; this.dy = 0;
          this.startMove(this.tileX + side, this.tileY - 1, this.effectiveSpeed());
          return;
        }
        // настоящий прыжок в открытый воздух → присед, затем замедленный прыжок (тяжесть).
        // print_jump «Толчковые опоры» — прыжок В 2 РАЗА выше (на 2 тайла, если над головой воздух).
        this.dx = 0; this.dy = -1;
        const jh = (typeof metaHas === 'function' && metaHas('print_jump') && world.tileAt(this.tileX, this.tileY - 2).type === AIR) ? 2 : 1;
        this.crouchT = JUMP_CROUCH_T; this.crouchTarget = [this.tileX, this.tileY - jh];
        this._jumpDesc = true; this._jumpDescDir = 0; this._jumpDescH = jh; this._jumpBufT = 0;   // прямой прыжок: зеркальное снижение прямо вниз той же высоты/скорости (симметрия)
        return;
      }
    }

    // --- IDLE: намерение (W/S приоритетнее A/D) ---
    let dx = 0, dy = 0;
    if (input.up())         dy = -1;
    else if (input.down())  dy =  1;
    else if (input.left())  dx = -1;
    else if (input.right()) dx =  1;

    if (anchored && (dx !== 0 || dy !== 0)) {   // ⚠️ ход/коп — ТОЛЬКО с опоры: в воздухе (в т.ч. на апексе прыжка) ввод не двигает вбок (иначе «полёт»/лишний шаг)
      this.dx = dx; this.dy = dy;
      const nx = this.tileX + dx, ny = this.tileY + dy;
      const t = world.tileAt(nx, ny);
      if (t.type === ROCK && s.canDig && !s.impulse && !s.screw && !(s.drillOverdrive && this.drillOverheatT > 0)) {   // ФОРСАЖ перегрет → бур не копает (лок-кулдаун)
        // бурим: соседняя порода = опора по определению (ИМПУЛЬСНЫЙ/ВИНТОВОЙ буры пассивно НЕ грызут — волна/автономные щиты)
        this.drilling = true; this.drillX = nx; this.drillY = ny;
        // КИНЕТИКА: разгон ПО ВРЕМЕНИ бурения в одну сторону. Смена направления → сброс. Мощность = lerp(база→макс)
        // по разгону + город(kinPower). Обычный бур — просто digMult.
        let dmult = s.digMult;
        if (s.kinetic) {
          const dd = dx + ',' + dy;
          if (this.kinDir !== null && this.kinDir !== dd) { this.kinRamp = 0; this.kinCharged = false; }   // ПОВЕРНУЛ — сброс разгона И суперзаряда
          this.kinDir = dd; this.kinIdleT = 0;
          this.kinRamp = Math.min(1, this.kinRamp + dt / KIN_RAMP_TIME);      // копим по времени бурения
          dmult = s.digMult + ((s.kinMax || KIN_MAX_MULT) - s.digMult) * this.kinRamp + (s.kinPower || 0);
        }
        if (this.latchTiles > 0) dmult *= LATCH_DRILL_SLOW;   // ДЕБАФФ прыгун (останок-робот): бур ослаблен, пока висит (сброс по проходке — game считает)
        if (s.drillOverdrive) dmult *= 1 + this.drillHeat * (s.overdriveBonus || OVERDRIVE_MAX_BONUS);   // ФОРСАЖ (реликт): нагрев→сила; пик скалируется город-апгрейдом (s.overdriveBonus)
        // ВЗРЫВНОЙ ПРОБОЙ (узел mast_dk_burst): праймленный суперзаряд делает ЭТУ тычку мгновенной — тайл дробится за один контакт.
        // Разгон при этом НЕ рвётся (копка непрерывна, kinDir тот же) — в отличие от «пробить сразу два тайла».
        let superHit = false;
        if (this.kinCharged && s.kinetic) { t.dig += digThreshold(t); this.kinCharged = false; superHit = true; }
        t.dig += dmult * dt;
        if (t.dig >= digThreshold(t)) {
          const res = t.resource;
          world.setAir(nx, ny);
          this.broke = true;
          if (res) this.dug = { x: nx, y: ny, type: res, amount: t.amount || 1 };   // количество залежи (1..3) → столько лута
          // ⚠️ НЕ ДОБАВЛЯЙ здесь startMove! На кадре ПРОБИТИЯ юнит ОСТАЁТСЯ НА МЕСТЕ (решено с игроком).
          //    Ставим «замок» на прокопанный тайл: тем же удержанием въедем только спустя DRILL_HOLD_ADVANCE
          //    (тоннель), а разовое нажатие (отпустил) — стоим. Избыток мощности бура в движение НЕ переходит.
          this._dugBlock = { x: nx, y: ny }; this._dugBlockT = 0;
          if (superHit) this.kinBurstFx = { x: nx, y: ny };   // FX на тайле, пробитом суперзарядом (заряд незаметен — вспышка сопровождает сам пробой)
          // ПРАЙМ следующего суперзаряда: после пробоя породы кинетикой с шансом — СЛЕДУЮЩАЯ тычка по породе мгновенна (разгон сохраняется).
          if (s.kinetic && this.kinRamp >= KIN_BURST_MIN_RAMP && typeof metaHas === 'function' && metaHas('mast_dk_burst') && Math.random() < KIN_BURST_CHANCE + (s.kinBurstBonus || 0)) this.kinCharged = true;
          // ЭХО-БУР (реликт): с шансом пробить случайный СОСЕДНИЙ тайл породы (любой бур; событие в game — лут/проходка/FX)
          if (s.echoDrill && Math.random() < (s.echoDrillChance || ECHO_DRILL_CHANCE)) {   // шанс эха скалируется город-апгрейдом
            const ed = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)], enx = nx + ed[0], eny = ny + ed[1];
            if (eny >= 0 && eny < MAP_H) { const et = world.tileAt(enx, eny); if (et && et.type === ROCK) { const eres = et.resource, eamt = et.amount || 1; world.setAir(enx, eny); this.echoBreak = { x: enx, y: eny, type: eres, amount: eamt }; } }
          }
        }
        return;
      }
      // ход в воздух (вбок/вниз) — только с опоры; подъём «вверх» обработан выше.
      // НО не въезжаем в ТОЛЬКО ЧТО прокопанный тайл тем же удержанием раньше DRILL_HOLD_ADVANCE
      // (разовое нажатие → стой; держишь дольше → заходишь = непрерывный тоннель).
      if (t.type === AIR && s.canMove && anchored) {
        if (this._dugBlock && this._dugBlock.x === nx && this._dugBlock.y === ny && this._dugBlockT < DRILL_HOLD_ADVANCE) return;
        this._dugBlock = null;
        // РАПЕЛЬ «Спрута»: шаг ВНИЗ в БЕЗОПОРНЫЙ воздух (обрыв/потолок полости) → взводим трос от точки схода:
        // вместо падения юнит спустится управляемо (вис держит _rappelHold, управление — ветка рапеля выше).
        const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[this.hull];
        if (dy === 1 && def && def.anchorLegs && !this.anchoredAt(world, nx, ny)) this.rappel = { hx: this.tileX, hy: this.tileY };
        this.startMove(nx, ny, this.effectiveSpeed()); return;
      }
    }

    // ГРАВИТАЦИЯ: без опоры и снизу пусто — падаем обычной (быстрой) скоростью. Дуга прыжка (подъём+снижение) идёт
    // ОТДЕЛЬНЫМИ ходами выше (симметрично, медленно); сюда попадаем уже ПОСЛЕ дуги (падение в яму под точкой приземления).
    // РАПЕЛЬ «Спрута» подавляет гравитацию: юнит ВИСИТ на тросе (управление висом — ветка выше).
    if (world.tileAt(this.tileX, this.tileY + 1).type === AIR && !anchored && !this._rappelHold(world)) {
      this.startMove(this.tileX, this.tileY + 1, FALL_SPEED);
    }
  }
}
