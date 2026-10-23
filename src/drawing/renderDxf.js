// Запись примитивов чертежа в DXF (AutoCAD R12, ASCII). Такой файл открывают КОМПАС, AutoCAD, LibreCAD,
// Fusion, Базис и большинство станочных программ.
// Русский текст пишем в виде \U+XXXX: так его понимают все версии без кодовых страниц.

import { LAYERS } from './layers.js';

const fixed = (v) => (Math.round(v * 1000) / 1000).toString();

function encodeText(str) {
  let out = '';
  for (const ch of String(str)) {
    const code = ch.codePointAt(0);
    out += code < 128 ? ch : '\\U+' + code.toString(16).toUpperCase().padStart(4, '0');
  }
  return out;
}

// height — высота листа: в DXF ось y направлена вверх, поэтому переворачиваем
export function itemsToDxf(items, height) {
  const g = []; // пары «код группы — значение»
  const put = (code, value) => g.push(String(code), String(value));
  const flip = (y) => height - y;

  put(0, 'SECTION'); put(2, 'HEADER'); put(9, '$ACADVER'); put(1, 'AC1009'); put(0, 'ENDSEC');

  put(0, 'SECTION'); put(2, 'TABLES');
  put(0, 'TABLE'); put(2, 'LTYPE'); put(70, 1);
  put(0, 'LTYPE'); put(2, 'CONTINUOUS'); put(70, 0); put(3, 'Solid line'); put(72, 65); put(73, 0); put(40, 0);
  put(0, 'ENDTAB');
  const layers = Object.values(LAYERS);
  put(0, 'TABLE'); put(2, 'LAYER'); put(70, layers.length);
  for (const l of layers) {
    put(0, 'LAYER'); put(2, l.dxf); put(70, 0); put(62, l.aci); put(6, 'CONTINUOUS');
  }
  put(0, 'ENDTAB');
  put(0, 'ENDSEC');

  put(0, 'SECTION'); put(2, 'ENTITIES');
  for (const it of items) {
    const layer = (LAYERS[it.layer] || LAYERS.outline).dxf;
    if (it.t === 'line') {
      put(0, 'LINE'); put(8, layer);
      put(10, fixed(it.x1)); put(20, fixed(flip(it.y1))); put(30, 0);
      put(11, fixed(it.x2)); put(21, fixed(flip(it.y2))); put(31, 0);
    } else {
      put(0, 'TEXT'); put(8, layer);
      put(10, fixed(it.x)); put(20, fixed(flip(it.y))); put(30, 0);
      put(40, fixed(it.size * 0.8)); // высота заглавной буквы меньше размера шрифта
      put(1, encodeText(it.text));
      if (it.rot) put(50, -it.rot);
      if (it.anchor === 'middle' || it.anchor === 'end') {
        put(72, it.anchor === 'middle' ? 1 : 2);
        put(11, fixed(it.x)); put(21, fixed(flip(it.y))); put(31, 0);
      }
    }
  }
  put(0, 'ENDSEC');
  put(0, 'EOF');
  return g.join('\r\n') + '\r\n';
}
