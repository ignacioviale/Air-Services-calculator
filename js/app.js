import { evaluar, formatHora, formatDuracion, ultimoDespegue } from './rules.js';

const STORAGE_KEY = 'servicio378:v1';
const form = document.getElementById('form');
const salida = document.getElementById('resultado');
const salida2 = document.getElementById('resultado2');
const vueloSeccion = document.getElementById('vueloSeccion');
const vueloChip = document.getElementById('vueloChip');
const vueloMax = document.getElementById('vueloMax');
const vueloNotas = document.getElementById('vueloNotas');
const despegueOut = document.getElementById('despegueOut');
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
    salida2.innerHTML = '';
    vueloSeccion.hidden = true;
    return;
  }
  const s = r.servicio;
  const esPiloto = datos.rol !== 'tcp';
  const et = ETIQUETAS[r.estado];
  let html = `<div class="banner ${r.estado}"><span class="big">${et.icono}</span><div><strong>${et.texto}</strong>
    <div class="banner-sub">Servicio ${formatDuracion(s.duracion)} h de ${formatDuracion(s.max)} h (${s.fuente})</div></div></div>`;

  const restante = s.margen >= 0
    ? { titulo: 'Tiempo de servicio restante', valor: s.margen }
    : { titulo: 'Tiempo de servicio excedido', valor: -s.margen };

  html += `<div class="card">
    <h2>${chip(s.estado)} Tiempo de servicio de vuelo</h2>
    <div class="grid">
      <div><span>Tiempo de servicio</span><b>${dur(s.duracion)}</b></div>
      <div><span>Tiempo máximo permitido</span><b>${dur(s.max)}<small> · ${s.fuente}</small></b></div>
      <div><span>Último arribo permitido</span><b>${hora(s.limiteArribo)}</b></div>
      <div><span>Último arribo con +20 %</span><b>${hora(s.limiteArriboExcepcion)}</b></div>
    </div>
    ${barra(s.duracion, s.max, s.maxExcepcion)}
    <div class="restante ${s.estado}">
      <span>${restante.titulo}</span>
      <b>${formatDuracion(restante.valor)}<small> h</small></b>
    </div>
    <p class="note center">Con excepción +20 %, el máximo es ${formatDuracion(s.maxExcepcion)} h.</p>
  </div>`;

  salida.innerHTML = html;
  html = '';
  vueloSeccion.hidden = !esPiloto;
  if (esPiloto) renderVuelo(r, datos);

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

  if (r.estado === 'excepcion') {
    r.avisos.push('Solo es válido con una causa del Art. 25 (imprevistos, emergencias, búsqueda y salvamento o defensa). El comandante tiene que hacer un informe (Art. 26).');
  }
  if (r.avisos.length) {
    html += `<div class="card warn">${r.avisos.map((a) => `<p>${a}</p>`).join('')}</div>`;
  }

  salida2.innerHTML = html;
}

function leerBlock(datos) {
  const hh = datos.blockH === '' || datos.blockH == null ? null : Number(datos.blockH);
  const mm = datos.blockM === '' || datos.blockM == null ? null : Number(datos.blockM);
  if (hh === null && mm === null) return null;
  const total = (hh || 0) * 60 + (mm || 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function renderVuelo(r, datos) {
  const v = r.vuelo;
  const s = r.servicio;
  const tope = (v.extendido ?? v.horas) * 60;
  vueloMax.innerHTML = `${formatDuracion(v.horas * 60)}<small> h</small>`;
  const notas = [`Máximo por ${v.fuente} del decreto.`];
  if (v.extendido) notas.push(`Hasta ${v.extendido} h con la extensión del ${v.fuenteExtendido}.`);
  if (v.extendido && datos.pilotos === 3) notas.push('El servicio máximo del Art. 11 puede ser menor que la extensión del Art. 12. Manda el servicio.');
  vueloNotas.textContent = notas.join(' ');

  const block = leerBlock(datos);
  if (block === null) {
    vueloChip.innerHTML = '';
    despegueOut.innerHTML = '<p class="note center">Cargá el block time para calcular el último despegue.</p>';
    return;
  }

  const u = ultimoDespegue(s.limiteArribo, block);
  const avisos = [];
  let estado = 'legal';
  if (block > tope) {
    estado = 'ilegal';
    avisos.push(`El block time (${formatDuracion(block)} h) supera el tiempo de vuelo permitido (${formatDuracion(tope)} h).`);
  }
  if (u.cierrePuertas < s.presentacion) {
    estado = 'ilegal';
    avisos.push('El tramo no entra en el tiempo de servicio: el cierre de puertas quedaría antes de la presentación.');
  }
  vueloChip.innerHTML = `${chip(estado)} `;
  despegueOut.innerHTML = `
    <div class="restante ${estado}">
      <span>Último horario cierre de puertas</span>
      <b>${hora(u.cierrePuertas)}</b>
    </div>
    <div class="grid">
      <div><span>Último despegue</span><b>${hora(u.despegue)}</b></div>
      <div><span>Último arribo permitido</span><b>${hora(u.arribo)}</b></div>
    </div>
    ${avisos.map((a) => `<p class="note aviso">${a}</p>`).join('')}`;
}

// Cuenta una "consulta" en GoatCounter cuando el usuario carga datos y obtiene un resultado.
// Espera 3 s sin cambios y no repite la misma presentación/arribo en la sesión.
const consultasContadas = new Set();
let timerConsulta = null;
function contarConsulta(datos, r) {
  clearTimeout(timerConsulta);
  if (r.error) return;
  const clave = `${datos.rol}|${datos.presentacion}|${datos.arribo}`;
  if (consultasContadas.has(clave)) return;
  timerConsulta = setTimeout(() => {
    if (!window.goatcounter || typeof window.goatcounter.count !== 'function') return;
    consultasContadas.add(clave);
    try {
      window.goatcounter.count({ path: 'consulta', title: 'Consulta de servicio', event: true });
    } catch { /* sin conexión o bloqueado */ }
  }, 3000);
}

function actualizar(evento) {
  const datos = leerFormulario();
  document.body.dataset.rol = datos.rol;
  document.body.dataset.tripulacion = datos.pilotos >= 3 ? 'aumentada' : 'minima';
  guardar(datos);
  const r = evaluar(datos);
  render(r, datos);
  if (evento) contarConsulta(datos, r);
}

form.addEventListener('input', actualizar);
form.addEventListener('change', actualizar);
vueloSeccion.addEventListener('input', actualizar);

form.querySelectorAll('button.now').forEach((b) => {
  b.addEventListener('click', () => {
    const ahora = new Date();
    document.getElementById(b.dataset.target).value =
      `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    actualizar(true);
  });
});

form.querySelectorAll('[data-step]').forEach((b) => {
  b.addEventListener('click', () => {
    const n = Math.min(7, Math.max(1, Number(segmentosInput.value) + Number(b.dataset.step)));
    segmentosInput.value = n;
    segmentosOut.textContent = n === 7 ? '7+' : n;
    actualizar(true);
  });
});

// Botón de modo claro / oscuro. Sin elección guardada, arranca en oscuro (lo fija index.html).
const botonTema = document.getElementById('tema');
function temaActual() {
  return document.documentElement.dataset.theme || 'dark';
}
function pintarBotonTema() {
  const oscuro = temaActual() === 'dark';
  botonTema.classList.toggle('oscuro', oscuro);
  botonTema.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}
botonTema.addEventListener('click', () => {
  const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem('tema', nuevo); } catch { /* sin almacenamiento */ }
  pintarBotonTema();
});
pintarBotonTema();

restaurar();
if (segmentosInput.value === '7') segmentosOut.textContent = '7+';
actualizar();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
