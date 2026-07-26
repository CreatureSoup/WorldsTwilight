'use strict';

// tools/webm.js — САМОДОСТАТОЧНЫЙ WebM-муксер из WebP-кейфреймов (мой код в репо, БЕЗ внешних зависимостей/CDN).
// Вход: массив {image:<dataURL image/webp lossy>, duration:<ms>}. Выход: Blob('video/webm'). Каждый кадр — VP8-кейфрейм
// (без интер-сжатия → файл крупный, зато ДЕТЕРМИНИРОВАННО, без ffmpeg/live-rAF). Валидируется через <video> (декодер
// браузера). Алгоритм-идея — Whammy (MIT), но vint-размеры и извлечение VP8 переписаны корректно. Юзер — tools/teaser.js.
window.WebM = (function () {
  // ── низкоуровневые байты ──
  function numToBuffer(num) { var p = []; if (num === 0) return new Uint8Array([0]); while (num > 0) { p.push(num & 0xff); num = Math.floor(num / 256); } return new Uint8Array(p.reverse()); }
  function idToBuffer(id) { var p = []; while (id > 0) { p.push(id & 0xff); id = Math.floor(id / 256); } return new Uint8Array(p.reverse()); }   // EBML id (уже vint-константа)
  function strToBuffer(str) { var a = new Uint8Array(str.length); for (var i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xff; return a; }
  function concat(arrs) { var t = 0, i; for (i = 0; i < arrs.length; i++) t += arrs[i].length; var o = new Uint8Array(t), off = 0; for (i = 0; i < arrs.length; i++) { o.set(arrs[i], off); off += arrs[i].length; } return o; }
  // vint-КОДИРОВАНИЕ размера данных EBML: N байт, маркер-бит на позиции (8−N) первого байта, значение в младших 7N битах.
  function vintSize(len) { var N = 1; while (len >= Math.pow(2, 7 * N) - 1) N++; var b = new Uint8Array(N), v = len, i; for (i = N - 1; i >= 0; i--) { b[i] = v & 0xff; v = Math.floor(v / 256); } b[0] |= (1 << (8 - N)); return b; }

  function generateEBML(json) {
    var parts = [];
    for (var i = 0; i < json.length; i++) {
      var el = json[i], data = el.data;
      if (Array.isArray(data)) data = generateEBML(data);
      else if (typeof data === 'number') data = numToBuffer(data);
      else if (typeof data === 'string') data = strToBuffer(data);
      // здесь data — Uint8Array
      parts.push(idToBuffer(el.id)); parts.push(vintSize(data.length)); parts.push(data);
    }
    return concat(parts);
  }

  function doubleToString(num) { return [].slice.call(new Uint8Array((new Float64Array([num])).buffer)).map(function (e) { return String.fromCharCode(e); }).reverse().join(''); }

  // SimpleBlock: [track vint][int16 BE timecode][flags][vp8 frame]
  function simpleBlock(trackNum, timecode, keyframe, vp8str) {
    var flags = keyframe ? 0x80 : 0;
    var head = String.fromCharCode(trackNum | 0x80) + String.fromCharCode((timecode >> 8) & 0xff) + String.fromCharCode(timecode & 0xff) + String.fromCharCode(flags);
    return strToBuffer(head + vp8str);
  }

  // Прямое извлечение VP8-кейфрейма из lossy-WebP: "RIFF"<sz>"WEBP""VP8 "<sz LE><vp8...>
  function extractVP8(bin) {
    var idx = bin.indexOf('VP8 '); if (idx < 0) throw new Error('not a lossy WebP (no VP8 chunk)');
    var o = idx + 4;
    var size = bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8) | (bin.charCodeAt(o + 2) << 16) | (bin.charCodeAt(o + 3) << 24);
    var vp8 = bin.substr(o + 4, size);
    var fs = vp8.indexOf('\x9d\x01\x2a'); var c = []; for (var i = 0; i < 4; i++) c[i] = vp8.charCodeAt(fs + 3 + i);
    return { data: vp8, width: (((c[1] << 8) | c[0]) & 0x3fff), height: (((c[3] << 8) | c[2]) & 0x3fff) };
  }
  function dataURLtoBin(u) { return atob(u.slice(u.indexOf(',') + 1)); }

  function toWebM(parsed) {
    var width = parsed[0].width, height = parsed[0].height, totalDur = 0, i;
    for (i = 0; i < parsed.length; i++) totalDur += parsed[i].duration;
    var segment = [
      { id: 0x1549a966, data: [   // Info
        { id: 0x2ad7b1, data: 1e6 }, { id: 0x4d80, data: 'twilight' }, { id: 0x5741, data: 'twilight' },
        { id: 0x4489, data: doubleToString(totalDur) },
      ] },
      { id: 0x1654ae6b, data: [   // Tracks
        { id: 0xae, data: [
          { id: 0xd7, data: 1 }, { id: 0x73c5, data: 1 }, { id: 0x9c, data: 0 }, { id: 0x22b59c, data: 'und' },
          { id: 0x86, data: 'V_VP8' }, { id: 0x83, data: 1 },
          { id: 0xe0, data: [ { id: 0xb0, data: width }, { id: 0xba, data: height } ] },
        ] },
      ] },
    ];
    var CLUSTER_MAX = 30000, n = 0, clusterTC = 0;
    while (n < parsed.length) {
      var cf = [], cdur = 0;
      do { cf.push(parsed[n]); cdur += parsed[n].duration; n++; } while (n < parsed.length && cdur < CLUSTER_MAX);
      var rel = 0, blocks = [ { id: 0xe7, data: clusterTC } ];
      for (i = 0; i < cf.length; i++) { blocks.push({ id: 0xa3, data: simpleBlock(1, Math.round(rel), true, cf[i].data) }); rel += cf[i].duration; }
      segment.push({ id: 0x1f43b675, data: blocks });   // Cluster
      clusterTC += cdur;
    }
    var ebml = [
      { id: 0x1a45dfa3, data: [
        { id: 0x4286, data: 1 }, { id: 0x42f7, data: 1 }, { id: 0x42f2, data: 4 }, { id: 0x42f3, data: 8 },
        { id: 0x4282, data: 'webm' }, { id: 0x4287, data: 2 }, { id: 0x4285, data: 2 },
      ] },
      { id: 0x18538067, data: segment },   // Segment
    ];
    return generateEBML(ebml);
  }

  function fromImages(frames) {
    var parsed = frames.map(function (f) { var v = extractVP8(dataURLtoBin(f.image)); v.duration = f.duration; return v; });
    return new Blob([toWebM(parsed)], { type: 'video/webm' });
  }
  return { fromImages: fromImages, _extractVP8: extractVP8 };
})();
