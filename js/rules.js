// Reglas del Decreto 378/2025 – Anexo I (Reglamentación Título V, Ley 17.285).
// Transporte aéreo regular. Todas las duraciones internas están en minutos.

const H = 60;

// Art. 9 a) – Tiempo máximo de vuelo con tripulación mínima, según hora de presentación.
export const ART9_MINIMA = [
  { desde: 0, hasta: 4 * H + 59, max: 8 },
  { desde: 5 * H, hasta: 19 * H + 59, max: 9 },
  { desde: 20 * H, hasta: 23 * H + 59, max: 8 },
];

// Art. 10 – Tiempo máximo de servicio de vuelo, tripulación mínima.
// Columnas: 1, 2, 3, 4, 5, 6, 7+ segmentos.
export const ART10 = [
  { desde: 0, hasta: 3 * H + 59, max: [9, 9, 9, 9, 9, 9, 9] },
  { desde: 4 * H, hasta: 4 * H + 59, max: [10, 10, 10, 10, 9, 9, 9] },
  { desde: 5 * H, hasta: 5 * H + 59, max: [12, 12, 12, 12, 11.5, 11, 10.5] },
  { desde: 6 * H, hasta: 6 * H + 59, max: [13, 13, 12, 12, 11.5, 11, 10.5] },
  { desde: 7 * H, hasta: 11 * H + 59, max: [14, 14, 13, 13, 12.5, 12, 11.5] },
  { desde: 12 * H, hasta: 12 * H + 59, max: [13, 13, 13, 13, 12.5, 12, 11.5] },
  { desde: 13 * H, hasta: 16 * H + 59, max: [12, 12, 12, 12, 11.5, 11, 10.5] },
  { desde: 17 * H, hasta: 21 * H + 59, max: [12, 12, 11, 11, 10, 9, 9] },
  { desde: 22 * H, hasta: 22 * H + 59, max: [11, 11, 10, 10, 9, 9, 9] },
  { desde: 23 * H, hasta: 23 * H + 59, max: [10, 10, 9, 9, 9, 9, 9] },
];

// Art. 11 – Tiempo máximo de servicio de vuelo, tripulación aumentada.
// max[clase][pilotos]
export const ART11 = [
  { desde: 0, hasta: 5 * H + 59, max: { 1: { 3: 15, 4: 17 }, 2: { 3: 14, 4: 15.5 }, 3: { 3: 13, 4: 13.5 } } },
  { desde: 6 * H, hasta: 6 * H + 59, max: { 1: { 3: 16, 4: 18.5 }, 2: { 3: 15, 4: 16.5 }, 3: { 3: 14, 4: 14.5 } } },
  { desde: 7 * H, hasta: 12 * H + 59, max: { 1: { 3: 17, 4: 19 }, 2: { 3: 16.5, 4: 18 }, 3: { 3: 15, 4: 15.5 } } },
  { desde: 13 * H, hasta: 16 * H + 59, max: { 1: { 3: 16, 4: 18.5 }, 2: { 3: 15, 4: 16.5 }, 3: { 3: 14, 4: 14.5 } } },
  { desde: 17 * H, hasta: 23 * H + 59, max: { 1: { 3: 15, 4: 17 }, 2: { 3: 14, 4: 15.5 }, 3: { 3: 13, 4: 13.5 } } },
];

export const DESCANSO_MINIMO = 10 * H; // Arts. 15 y 19
export const DESCANSO_COMPANIA = 12 * H; // Resolución de la compañía (no modifica el decreto)
export const EXCEPCION_24H = 0.2; // Art. 24
export const EXCEPCION_MES = 0.1; // Art. 24
export const LIMITE_MES = 120; // Art. 8 b)
export const LIMITE_ANIO = 1000; // Art. 8 a)

const ESTADOS = ['legal', 'excepcion', 'ilegal'];

export function peorEstado(...estados) {
  return estados.filter(Boolean).reduce((a, b) => (ESTADOS.indexOf(b) > ESTADOS.indexOf(a) ? b : a), 'legal');
}

export function parseHora(texto) {
  if (typeof texto !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * H + min;
}

// Minutos absolutos (desde las 00:00 del día de presentación) -> "HH:MM" y días de diferencia.
export function formatHora(minutos) {
  const dia = Math.floor(minutos / (24 * H));
  const resto = ((minutos % (24 * H)) + 24 * H) % (24 * H);
  const hh = String(Math.floor(resto / H)).padStart(2, '0');
  const mm = String(resto % H).padStart(2, '0');
  return { hora: `${hh}:${mm}`, dia };
}

export function formatDuracion(minutos) {
  const signo = minutos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutos));
  return `${signo}${Math.floor(abs / H)}:${String(abs % H).padStart(2, '0')}`;
}

function buscarFila(tabla, minutoDelDia) {
  return tabla.find((f) => minutoDelDia >= f.desde && minutoDelDia <= f.hasta);
}

function estadoContraLimite(valor, max, extra = EXCEPCION_24H) {
  if (valor <= max) return 'legal';
  if (valor <= max * (1 + extra)) return 'excepcion';
  return 'ilegal';
}

// Devuelve el minuto absoluto de `hora` igual o posterior a `referencia` (avanza días si hace falta).
function siguienteOcurrencia(hora, referencia, estricto = true) {
  let t = hora + Math.floor(referencia / (24 * H)) * 24 * H;
  while (estricto ? t <= referencia : t < referencia) t += 24 * H;
  return t;
}

export function maxServicioPiloto({ presentacion, pilotos, claseDescanso, segmentos }) {
  if (pilotos >= 3) {
    const fila = buscarFila(ART11, presentacion);
    return { horas: fila.max[claseDescanso][pilotos], fuente: 'Art. 11' };
  }
  const fila = buscarFila(ART10, presentacion);
  const col = Math.min(Math.max(segmentos, 1), 7) - 1;
  return { horas: fila.max[col], fuente: 'Art. 10' };
}

export function maxVueloPiloto({ presentacion, pilotos, claseDescanso }) {
  if (pilotos === 3) {
    // Art. 9 b) y Art. 12 (asiento reclinable > 40°, área separada).
    return { horas: 13, fuente: 'Art. 9 b)', extendido: 17, fuenteExtendido: 'Art. 12' };
  }
  if (pilotos === 4) {
    // Art. 9 c) y Art. 12 (espacio horizontal separado de pasajeros = clase 1).
    const ext = claseDescanso === 1 ? { extendido: 19, fuenteExtendido: 'Art. 12' } : {};
    return { horas: 17, fuente: 'Art. 9 c)', ...ext };
  }
  return { horas: buscarFila(ART9_MINIMA, presentacion).max, fuente: 'Art. 9 a)' };
}

export function maxServicioTcp(adicionales) {
  const n = Math.min(Math.max(adicionales || 0, 0), 2);
  return { horas: [14, 16, 18][n], fuente: 'Art. 18' };
}

/**
 * Evalúa un servicio de vuelo.
 * @param {object} e
 * @param {'piloto'|'tcp'} e.rol
 * @param {string} e.presentacion  "HH:MM" hora local de presentación
 * @param {string} e.arribo        "HH:MM" calzos del último arribo
 * @param {number} [e.pilotos]     2 (mínima), 3 o 4
 * @param {number} [e.claseDescanso] 1, 2 o 3 (tripulación aumentada)
 * @param {number} [e.segmentos]
 * @param {number|null} [e.tiempoVuelo] horas de vuelo (calzo a calzo) del servicio
 * @param {string|null} [e.trasladoFin] "HH:MM" fin del traslado como pasajero (Art. 13)
 * @param {number} [e.tcpAdicionales] 0, 1 o 2
 * @param {number|null} [e.asientos]
 * @param {number|null} [e.horasMes] horas de vuelo del mes, incluido este servicio
 * @param {number|null} [e.horasAnio] horas de vuelo del año, incluido este servicio
 */
export function evaluar(e) {
  const pres = parseHora(e.presentacion);
  const arrHora = parseHora(e.arribo);
  if (pres === null || arrHora === null || pres === arrHora) {
    return { error: 'Ingresá la hora de presentación y la del último arribo.' };
  }

  const arribo = siguienteOcurrencia(arrHora, pres);
  const duracion = arribo - pres;
  const esPiloto = e.rol !== 'tcp';
  const pilotos = esPiloto ? Number(e.pilotos) || 2 : null;
  const claseDescanso = Number(e.claseDescanso) || 1;
  const segmentos = Number(e.segmentos) || 1;

  const res = { duracion, presentacion: pres, arribo, checks: [], avisos: [] };

  // --- Tiempo de servicio de vuelo ---
  const lim = esPiloto
    ? maxServicioPiloto({ presentacion: pres, pilotos, claseDescanso, segmentos })
    : maxServicioTcp(e.tcpAdicionales);
  const maxMin = Math.round(lim.horas * H);
  const maxExcMin = Math.round(lim.horas * (1 + EXCEPCION_24H) * H);
  const estadoServicio = estadoContraLimite(duracion, maxMin);
  res.servicio = {
    duracion,
    max: maxMin,
    maxExcepcion: maxExcMin,
    margen: maxMin - duracion,
    limiteArribo: pres + maxMin,
    limiteArriboExcepcion: pres + maxExcMin,
    fuente: lim.fuente,
    estado: estadoServicio,
  };
  res.checks.push({ id: 'servicio', titulo: 'Tiempo de servicio de vuelo', estado: estadoServicio });

  // --- Tiempo de vuelo (pilotos) ---
  const tv = e.tiempoVuelo === '' || e.tiempoVuelo == null ? null : Number(e.tiempoVuelo);
  if (esPiloto) {
    const lv = maxVueloPiloto({ presentacion: pres, pilotos, claseDescanso });
    res.vuelo = { ...lv };
    if (tv !== null && !Number.isNaN(tv)) {
      const tvMin = Math.round(tv * H);
      const tope = lv.extendido ?? lv.horas;
      let estado = estadoContraLimite(tvMin, tope * H);
      res.vuelo.tiempo = tvMin;
      res.vuelo.usaExtension = lv.extendido != null && tvMin > lv.horas * H && tvMin <= lv.extendido * H;
      res.vuelo.estado = estado;
      if (tvMin > duracion) {
        res.avisos.push('El tiempo de vuelo no puede ser mayor que el tiempo de servicio. Revisá los datos.');
      }
      res.checks.push({ id: 'vuelo', titulo: 'Tiempo de vuelo', estado });
    }
  }

  // --- Descanso mínimo ---
  let finServicio = arribo;
  let computoDescanso = duracion;
  if (esPiloto && e.trasladoFin) {
    const tf = parseHora(e.trasladoFin);
    if (tf !== null) {
      finServicio = siguienteOcurrencia(tf, arribo, false);
      computoDescanso = finServicio - pres; // Art. 13: el traslado se suma al servicio para el descanso.
      if (tf < arrHora) {
        res.avisos.push(`El fin del traslado (${e.trasladoFin}) es anterior al arribo (${e.arribo}): se tomó como del día siguiente, ${formatDuracion(finServicio - arribo)} h de traslado. Revisá los datos.`);
      }
    }
  }
  let descanso;
  if (esPiloto) {
    descanso = Math.max(DESCANSO_MINIMO, computoDescanso); // Art. 15
  } else {
    const exceso = Math.max(0, duracion - maxMin);
    descanso = DESCANSO_MINIMO + exceso; // Art. 19
  }
  const descansoCompania = Math.max(descanso, DESCANSO_COMPANIA);
  res.descanso = {
    minimo: descanso,
    compania: descansoCompania,
    desde: finServicio,
    proximaPresentacion: finServicio + descansoCompania,
    proximaPresentacionDecreto: finServicio + descanso,
    fuente: esPiloto ? (finServicio !== arribo ? 'Arts. 13 y 15' : 'Art. 15') : 'Art. 19',
  };

  // --- Acumulados (pilotos) ---
  if (esPiloto) {
    const mes = e.horasMes === '' || e.horasMes == null ? null : Number(e.horasMes);
    const anio = e.horasAnio === '' || e.horasAnio == null ? null : Number(e.horasAnio);
    res.acumulados = {};
    if (mes !== null && !Number.isNaN(mes)) {
      const estado = estadoContraLimite(mes, LIMITE_MES, EXCEPCION_MES);
      res.acumulados.mes = { horas: mes, max: LIMITE_MES, maxExcepcion: LIMITE_MES * (1 + EXCEPCION_MES), estado };
      res.checks.push({ id: 'mes', titulo: 'Horas de vuelo del mes', estado });
    }
    if (anio !== null && !Number.isNaN(anio)) {
      const estado = anio <= LIMITE_ANIO ? 'legal' : 'ilegal';
      res.acumulados.anio = { horas: anio, max: LIMITE_ANIO, estado };
      res.checks.push({ id: 'anio', titulo: 'Horas de vuelo del año', estado });
    }
  }

  // --- TCP: tripulación mínima de cabina ---
  if (!esPiloto) {
    const asientos = Number(e.asientos) || 0;
    if (asientos > 19) {
      res.tcpMinimos = Math.ceil(asientos / 50);
    }
  }

  res.estado = peorEstado(...res.checks.map((c) => c.estado));
  return res;
}
