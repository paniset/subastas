// Buscador de la portada: lee lotes.json (mismo origen) y pinta los lotes que cumplen el filtro.
// Sin innerHTML: todo el texto entra con textContent.

export const CATEGORIAS = {
  'pisos-y-casas': 'Pisos y casas', 'locales-y-naves': 'Locales y naves', 'garajes-y-trasteros': 'Garajes y trasteros',
  'solares-y-terrenos': 'Solares y terrenos', 'fincas-rusticas': 'Fincas rústicas', 'otros-inmuebles': 'Otros inmuebles',
  'coches': 'Coches y vehículos', 'motos': 'Motos', 'camiones-y-maquinaria': 'Camiones y maquinaria', 'barcos': 'Barcos',
  'aeronaves': 'Aeronaves', 'chatarra': 'Chatarra', 'joyas-arte-y-objetos': 'Joyas, arte y objetos',
  'mobiliario-y-equipos': 'Mobiliario y otros bienes',
};
const POR_PAGINA = 30;

export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filtrar(lotes, { categoria = '', provincia = '', fuente = '', texto = '' } = {}) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  return lotes.filter((l) => (!categoria || l.categoria === categoria)
    && (!provincia || l.provincia === provincia)
    && (!fuente || l.fuente === fuente)
    && palabras.every((p) => normalizar(`${l.titulo} ${l.detalle ?? ''} ${l.localidad ?? ''} ${l.provincia ?? ''}`).includes(p)));
}

export function euros(x) {
  if (x === undefined || x === null) return '';
  return `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }).format(x)} €`;
}

export function superficie(x) {
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' }).format(x)} m²`;
}

export function fecha(iso) {
  if (!iso) return '';
  const d = `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return iso.length > 10 ? `${d} a las ${iso.slice(11, 16)}` : d;
}

/** Líneas de texto de un lote, en el mismo orden que las tarjetas generadas en Python. */
export function lineas(l) {
  const meta = [CATEGORIAS[l.categoria] ?? 'Sin clasificar'];
  const localidad = normalizar(l.localidad) === normalizar(l.provincia) ? '' : l.localidad;
  const lugar = [localidad, l.provincia].filter(Boolean).join(', ');
  if (lugar) meta.push(lugar);
  if (l.fecha) meta.push(`Subasta: ${fecha(l.fecha)}`);
  if (l.publicado && l.origen === 'BOE') meta.push(`BOE del ${fecha(l.publicado)}`);
  const precio = [];
  if (l.salida !== undefined) precio.push(`Salida${l.lote && l.tasacion !== l.salida ? ` del lote ${l.lote}` : ''}: ${euros(l.salida)}`);
  if (l.tasacion !== undefined && l.tasacion !== l.salida) precio.push(`Tasación del bien: ${euros(l.tasacion)}`);
  if (l.cargas !== undefined) precio.push(l.cargas === 0 ? 'Sin cargas' : `Cargas: ${euros(l.cargas)}`);
  if (l.superficie) precio.push(superficie(l.superficie));
  let enlace = 'Ficha en Patrimonio del Estado';
  if (l.origen === 'Seguridad Social') enlace = `Seguridad Social (elige «${l.tipo_ss}»${l.provincia ? ` → ${l.provincia}` : ''}${l.lote ? ` → lote ${l.lote}` : ''})`;
  else if (l.origen === 'BOE') enlace = `Anuncio ${l.id} en el BOE`;
  const leido = l.leido ? ` · leído el ${fecha(l.leido)}` : '';
  return { titulo: l.titulo, meta: meta.join(' · '), estado: l.estado ?? '', detalle: l.detalle ?? '', precio: precio.join(' · '), enlace, leido };
}

function tarjeta(doc, l) {
  const t = lineas(l);
  const li = doc.createElement('li');
  li.className = 'lote';
  const parte = (etiqueta, clase, texto) => {
    if (!texto) return;
    const n = doc.createElement(etiqueta);
    if (clase) n.className = clase;
    n.textContent = texto;
    li.append(n);
  };
  parte('h3', '', t.titulo);
  parte('p', 'meta', t.meta);
  parte('p', 'estado', t.estado);
  parte('p', 'detalle', t.detalle.slice(0, 240));
  parte('p', 'precio', t.precio);
  const p = doc.createElement('p');
  p.className = 'fuente';
  p.append('Fuente: ');
  const a = doc.createElement('a');
  a.href = /^https:\/\//.test(l.url) ? l.url : '#';
  a.rel = 'noopener';
  a.textContent = t.enlace;
  p.append(a, t.leido);
  li.append(p);
  return li;
}

async function iniciar(doc) {
  const form = doc.getElementById('filtro');
  if (!form) return;
  const campos = ['categoria', 'provincia', 'fuente', 'texto'].map((k) => [k, doc.getElementById(`f-${k}`)]);
  const resumen = doc.getElementById('f-resumen');
  const lista = doc.getElementById('f-resultados');
  const mas = doc.getElementById('f-mas');
  let lotes = [];
  let vistos = POR_PAGINA;
  try {
    const r = await fetch('./lotes.json');
    lotes = (await r.json()).lotes;
  } catch {
    resumen.textContent = 'No se pudo cargar el buscador. Usa las listas por categoría y provincia de abajo.';
    return;
  }
  const params = new URLSearchParams(doc.defaultView.location.search);
  for (const [k, campo] of campos) if (params.get(k)) campo.value = params.get(k);
  const pintar = () => {
    const filtro = Object.fromEntries(campos.map(([k, c]) => [k, c.value]));
    const activo = Object.values(filtro).some(Boolean);
    lista.replaceChildren();
    if (!activo) {
      resumen.textContent = `${lotes.length} lotes y anuncios. Elige una categoría o una provincia, o entra en las listas de abajo.`;
      mas.hidden = true;
      return;
    }
    const hallados = filtrar(lotes, filtro);
    resumen.textContent = hallados.length === 1 ? '1 resultado.' : `${hallados.length} resultados.`;
    for (const l of hallados.slice(0, vistos)) lista.append(tarjeta(doc, l));
    mas.hidden = hallados.length <= vistos;
  };
  form.addEventListener('submit', (ev) => ev.preventDefault());
  for (const [, campo] of campos) campo.addEventListener('input', () => { vistos = POR_PAGINA; pintar(); });
  mas.addEventListener('click', () => { vistos += POR_PAGINA; pintar(); });
  pintar();
}

if (typeof document !== 'undefined') iniciar(document);
