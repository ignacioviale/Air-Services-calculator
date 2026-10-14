import { evaluar, formatHora, formatDuracion } from './rules.js';

const STORAGE_KEY = 'servicio378:v1';
const form = document.getElementById('form');
const salida = document.getElementById('resultado');
const segmentosInput = document.getElementById('segmentos');
const segmentosOut = document.getElementById('segmentosOut');

const ETIQUETAS = {
  legal: { texto: 'Dentro del decreto', icono: '✓' },
  excepcion: { texto: 'Solo con excepción (Art. 24)', icono: '!' },
  ilegal: { texto: 'Fuera del decreto', icono: '✕' },
};

function leerFormulario() {
  const d = Object.fromEntries(new FormData(form).entries());
  d.pilotos = Number(d.pilotos);
  d.claseDescanso = Number(d.claseDescanso);
  d.segmentos = Number(d.segmentos);
  d.tcpAdicionales = Number(d.tcpAdicionales);
  return d;
}

function guardar(datos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
}

function restaurar() {
  let datos = null;
  try { datos = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* sin almacenamiento */ }
  if (!datos) return;
  for (const [k, v] of Object.entries(datos)) {
    const campos = form.elements[k];
    if (!campos) continue;
    if (campos instanceof RadioNodeList) {
      for (const r of campos) r.checked = r.value === String(v);
    } else {
      campos.value = v;
    }
  }
  segmentosOut.textContent = segmentosInput.value;
}

function hora(minutos) {
  const { hora: hh, dia } = formatHora(minutos);
  return dia > 0 ? `${hh}<small> +${dia}d</small>` : hh;
}

function dur(minutos) {
  return `${formatDuracion(minutos)}<small> h</small>`;
}

function chip(estado) {
  return `<span class="chip ${estado}">${ETIQUETAS[estado].icono}</span>`;
}

function barra(valor, max, maxExc) {
  const tope = Math.max(valor, maxExc);
  const pct = (x) => Math.min(100, (x / tope) * 100).toFixed(1);
  return `<div class="bar" aria-hidden="true">
    <div class="fill" style="width:${pct(valor)}%"></div>
    <div class="mark" style="left:${pct(max)}%"></div>
    <div class="mark exc" style="left:${pct(maxExc)}%"></div>
  </div>`;
}

function render(r, datos) {
  if (r.error) {
    salida.innerHTML = `<div class="empty">${r.error}</div>`;
    return;
  }
  const s = r.servicio;
  const esPiloto = datos.rol !== 'tcp';
  const et = ETIQUETAS[r.estado];
  let html = `<div class="banner ${r.estado}"><span class="big">${et.icono}</span><div><strong>${et.texto}</strong>
    <div class="banner-sub">Servicio ${formatDuracion(s.duracion)} h de ${formatDuracion(s.max)} h (${s.fuente})</div></div></div>`;

  const margenTxt = s.margen >= 0
    ? `Te quedan <strong>${formatDuracion(s.margen)} h</strong>`
    : `Te pasaste por <strong>${formatDuracion(-s.margen)} h</strong>`;

  html += `<div class="card">
    <h2>${chip(s.estado)} Tiempo de servicio de vuelo</h2>
    <div class="grid">
      <div><span>Duración</span><b>${dur(s.duracion)}</b></div>
      <div><span>Máximo · ${s.fuente}</span><b>${dur(s.max)}</b></div>
      <div><span>Arribo límite</span><b>${hora(s.limiteArribo)}</b></div>
      <div><span>Límite con excepción +20 %</span><b>${hora(s.limiteArriboExcepcion)}</b></div>
    </div>
    ${barra(s.duracion, s.max, s.maxExcepcion)}
    <p class="note">${margenTxt}. Con excepción, el máximo es ${formatDuracion(s.maxExcepcion)} h.</p>
  </div>`;

  if (esPiloto && r.vuelo) {
    const v = r.vuelo;
    const maxTxt = v.extendido ? `${v.horas} h · hasta ${v.extendido} h (${v.fuenteExtendido})` : `${v.horas} h`;
    html += `<div class="card">
      <h2>${v.estado ? chip(v.estado) : ''} Tiempo de vuelo</h2>
      <div class="grid">
        <div><span>Máximo · ${v.fuente}</span><b class="sm">${maxTxt}</b></div>
        ${v.tiempo != null ? `<div><span>Este servicio</span><b>${dur(v.tiempo)}</b></div>` : '<div><span>Este servicio</span><b class="sm muted">Cargalo en “Más datos”</b></div>'}
      </div>
      ${v.usaExtension ? `<p class="note">Usás la extensión del Art. 12: ${datos.pilotos === 3 ? 'hace falta un asiento reclinable de más de 40° en un área separada' : 'hace falta un espacio horizontal separado de los pasajeros'}.</p>` : ''}
      ${v.extendido && datos.pilotos === 3 ? '<p class="note">Ojo: el servicio máximo del Art. 11 puede ser menor que la extensión del Art. 12. Manda el servicio.</p>' : ''}
    </div>`;
  }

  const d = r.descanso;
  html += `<div class="card">
    <h2>Descanso mínimo</h2>
    <div class="grid">
      <div><span>Descanso por compañía</span><b>${dur(d.compania)}</b></div>
      <div><span>Descanso por decreto</span><b>${dur(d.minimo)}</b></div>
      <div><span>Fin de servicio (calzas)</span><b>${hora(d.desde)}</b></div>
      <div><span>Próxima presentación</span><b>${hora(d.proximaPresentacion)}</b></div>
    </div>
    <p class="note">Por Decreto: descanso mínimo desde calzas puestas: 10 hs.</p>
    <p class="note">Por Compañía: descanso mínimo desde calzas puestas: 12 hs.</p>
  </div>`;

  if (esPiloto && r.acumulados && (r.acumulados.mes || r.acumulados.anio)) {
    const a = r.acumulados;
    html += `<div class="card"><h2>Acumulados de vuelo · Art. 8</h2><div class="grid">`;
    if (a.mes) html += `<div><span>${chip(a.mes.estado)} Mes</span><b>${a.mes.horas}<small> / 120 h</small></b></div>`;
    if (a.anio) html += `<div><span>${chip(a.anio.estado)} Año</span><b>${a.anio.horas}<small> / 1000 h</small></b></div>`;
    html += `</div>${a.mes && a.mes.estado !== 'legal' ? '<p class="note">En el mes se puede exceder hasta un 10 % (132 h) solo por las causas del Art. 25.</p>' : ''}</div>`;
  }

  if (!esPiloto && r.tcpMinimos) {
    html += `<div class="card"><h2>Tripulación mínima de cabina</h2>
      <p class="note">${r.tcpMinimos} TCP para ${datos.asientos} asientos (1 cada 50 o fracción). Con +1 el servicio máximo sube a 16 h, y con +2 a 18 h.</p></div>`;
  }

  if (r.estado === 'excepcion') {
    r.avisos.push('Solo es válido con una causa del Art. 25 (imprevistos, emergencias, búsqueda y salvamento o defensa). El comandante tiene que hacer un informe (Art. 26).');
  }
  if (r.avisos.length) {
    html += `<div class="card warn">${r.avisos.map((a) => `<p>${a}</p>`).join('')}</div>`;
  }

  salida.innerHTML = html;
}

function actualizar() {
  const datos = leerFormulario();
  document.body.dataset.rol = datos.rol;
  document.body.dataset.tripulacion = datos.pilotos >= 3 ? 'aumentada' : 'minima';
  guardar(datos);
  render(evaluar(datos), datos);
}

form.addEventListener('input', actualizar);
form.addEventListener('change', actualizar);

form.querySelectorAll('button.now').forEach((b) => {
  b.addEventListener('click', () => {
    const ahora = new Date();
    document.getElementById(b.dataset.target).value =
      `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    actualizar();
  });
});

form.querySelectorAll('[data-step]').forEach((b) => {
  b.addEventListener('click', () => {
    const n = Math.min(7, Math.max(1, Number(segmentosInput.value) + Number(b.dataset.step)));
    segmentosInput.value = n;
    segmentosOut.textContent = n === 7 ? '7+' : n;
    actualizar();
  });
});

document.getElementById('limpiar').addEventListener('click', () => {
  ['tiempoVuelo', 'trasladoFin', 'horasMes', 'horasAnio', 'asientos'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  actualizar();
});

restaurar();
if (segmentosInput.value === '7') segmentosOut.textContent = '7+';
actualizar();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
