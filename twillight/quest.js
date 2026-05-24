'use strict';

// Quest — задание от города (первый код-шаг §9.9 design_meta). Пока один тип:
// «поставка N ресурса» контрактному (домашнему) городу. Прогресс копится при сдаче
// груза на базе; дедлайн — в циклах. Успех/провал двигают репутацию города (в save).
// Логика заданий живёт здесь; начисление репутации и UI — в game/hud.
const QUEST_DEADLINE_CYCLES = 4;  // циклов на выполнение
const QUEST_MSG_TIME = 6;         // сек показа уведомления о результате
const RES_NAMES = { iron: 'железо', organic: 'органика', crystal: 'кристалл' };

class Quest {
  constructor(resource, amount, deadlineCycle) {
    this.type = 'deliver';
    this.resource = resource;
    this.amount = amount;
    this.progress = 0;
    this.deadlineCycle = deadlineCycle;
    this.state = 'active';          // active | done | failed
  }
  // сдана единица груза типа type; true — если задание ИМЕННО сейчас выполнено
  onDeliver(type) {
    if (this.state !== 'active' || type !== this.resource) return false;
    this.progress = Math.min(this.amount, this.progress + 1);
    if (this.progress >= this.amount) { this.state = 'done'; return true; }
    return false;
  }
  // true — если задание ИМЕННО сейчас провалено по дедлайну
  checkDeadline(cycleN) {
    if (this.state === 'active' && cycleN > this.deadlineCycle) { this.state = 'failed'; return true; }
    return false;
  }
  label() { return `сдать ${RES_NAMES[this.resource]} ${this.progress}/${this.amount}`; }
}

// Генерация задания: реже ресурс → меньше требуемое количество (≈ редкости в породе).
function makeQuest(cycleN) {
  const pool = [['iron', 8], ['iron', 6], ['organic', 5], ['crystal', 3]];
  const p = pool[Math.floor(Math.random() * pool.length)];
  return new Quest(p[0], p[1], cycleN + QUEST_DEADLINE_CYCLES);
}
