import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluar, formatHora, formatDuracion, maxServicioPiloto, maxVueloPiloto } from '../js/rules.js';

const h = (x) => x * 60;

test('Art. 10: tripulación mínima, 07:00 con 2 segmentos = 14 h', () => {
  assert.equal(maxServicioPiloto({ presentacion: h(7), pilotos: 2, segmentos: 2 }).horas, 14);
});

test('Art. 10: 7 o más segmentos usan la última columna', () => {
  assert.equal(maxServicioPiloto({ presentacion: h(5), pilotos: 2, segmentos: 9 }).horas, 10.5);
});

test('Art. 10: bordes de franja horaria', () => {
  assert.equal(maxServicioPiloto({ presentacion: h(3) + 59, pilotos: 2, segmentos: 1 }).horas, 9);
  assert.equal(maxServicioPiloto({ presentacion: h(4), pilotos: 2, segmentos: 1 }).horas, 10);
  assert.equal(maxServicioPiloto({ presentacion: h(23) + 59, pilotos: 2, segmentos: 3 }).horas, 9);
});

test('Art. 11: tripulación aumentada', () => {
  assert.equal(maxServicioPiloto({ presentacion: h(8), pilotos: 4, claseDescanso: 1 }).horas, 19);
  assert.equal(maxServicioPiloto({ presentacion: h(2), pilotos: 3, claseDescanso: 3 }).horas, 13);
  assert.equal(maxServicioPiloto({ presentacion: h(14), pilotos: 4, claseDescanso: 2 }).horas, 16.5);
});

test('Art. 9 y 12: tiempo de vuelo', () => {
  assert.equal(maxVueloPiloto({ presentacion: h(4) + 59, pilotos: 2 }).horas, 8);
  assert.equal(maxVueloPiloto({ presentacion: h(5), pilotos: 2 }).horas, 9);
  assert.equal(maxVueloPiloto({ presentacion: h(20), pilotos: 2 }).horas, 8);
  assert.equal(maxVueloPiloto({ presentacion: h(10), pilotos: 3, claseDescanso: 3 }).extendido, 17);
  assert.equal(maxVueloPiloto({ presentacion: h(10), pilotos: 4, claseDescanso: 1 }).extendido, 19);
  assert.equal(maxVueloPiloto({ presentacion: h(10), pilotos: 4, claseDescanso: 2 }).extendido, undefined);
});

test('servicio legal con margen y descanso mínimo de 10 h', () => {
  const r = evaluar({ rol: 'piloto', presentacion: '07:00', arribo: '15:30', pilotos: 2, segmentos: 2 });
  assert.equal(r.estado, 'legal');
  assert.equal(r.servicio.duracion, h(8.5));
  assert.equal(r.servicio.margen, h(5.5));
  assert.deepEqual(formatHora(r.servicio.limiteArribo), { hora: '21:00', dia: 0 });
  assert.equal(r.descanso.minimo, h(10));
  assert.deepEqual(formatHora(r.descanso.proximaPresentacion), { hora: '01:30', dia: 1 });
});

test('arribo después de medianoche cruza de día', () => {
  const r = evaluar({ rol: 'piloto', presentacion: '18:00', arribo: '02:00', pilotos: 2, segmentos: 1 });
  assert.equal(r.servicio.duracion, h(8));
  assert.equal(r.estado, 'legal');
});

test('excede pero dentro del +20 % queda como excepción (Art. 24)', () => {
  // 23:00, 3 segmentos -> 9 h; 10 h está dentro de 10,8 h
  const r = evaluar({ rol: 'piloto', presentacion: '23:00', arribo: '09:00', pilotos: 2, segmentos: 3 });
  assert.equal(r.servicio.estado, 'excepcion');
  assert.equal(r.estado, 'excepcion');
  assert.equal(r.descanso.minimo, h(10));
});

test('excede el +20 % = fuera del decreto', () => {
  const r = evaluar({ rol: 'piloto', presentacion: '23:00', arribo: '11:00', pilotos: 2, segmentos: 3 });
  assert.equal(r.estado, 'ilegal');
  assert.equal(r.descanso.minimo, h(12)); // descanso = duración del servicio
});

test('Art. 13: traslado como pasajero suma para el descanso', () => {
  const r = evaluar({ rol: 'piloto', presentacion: '06:00', arribo: '16:00', trasladoFin: '18:00', pilotos: 2, segmentos: 2 });
  assert.equal(r.descanso.minimo, h(12));
  assert.deepEqual(formatHora(r.descanso.proximaPresentacion), { hora: '06:00', dia: 1 });
});

test('tiempo de vuelo usando la extensión del Art. 12', () => {
  const r = evaluar({ rol: 'piloto', presentacion: '08:00', arribo: '01:00', pilotos: 4, claseDescanso: 1, tiempoVuelo: 15 });
  assert.equal(r.vuelo.estado, 'legal');
  assert.equal(r.vuelo.usaExtension, false);
  const r2 = evaluar({ rol: 'piloto', presentacion: '08:00', arribo: '02:00', pilotos: 4, claseDescanso: 1, tiempoVuelo: 17.5 });
  assert.equal(r2.vuelo.usaExtension, true);
  assert.equal(r2.estado, 'legal');
});

test('acumulados mensuales y anuales', () => {
  const base = { rol: 'piloto', presentacion: '07:00', arribo: '12:00', pilotos: 2, segmentos: 1 };
  assert.equal(evaluar({ ...base, horasMes: 125 }).estado, 'excepcion');
  assert.equal(evaluar({ ...base, horasMes: 133 }).estado, 'ilegal');
  assert.equal(evaluar({ ...base, horasAnio: 1001 }).estado, 'ilegal');
});

test('TCP: Art. 18 y descanso compensatorio del Art. 19', () => {
  const r = evaluar({ rol: 'tcp', presentacion: '05:00', arribo: '20:00', tcpAdicionales: 0, asientos: 180 });
  assert.equal(r.servicio.max, h(14));
  assert.equal(r.servicio.estado, 'excepcion');
  assert.equal(r.descanso.minimo, h(11));
  assert.equal(r.tcpMinimos, 4);
  assert.equal(evaluar({ rol: 'tcp', presentacion: '05:00', arribo: '20:00', tcpAdicionales: 1 }).estado, 'legal');
});

test('formatDuracion', () => {
  assert.equal(formatDuracion(h(5.5)), '5:30');
  assert.equal(formatDuracion(-90), '-1:30');
});

test('datos incompletos devuelven error', () => {
  assert.ok(evaluar({ rol: 'piloto', presentacion: '', arribo: '10:00' }).error);
});
