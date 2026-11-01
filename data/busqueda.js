// Catálogo que trae la app. Los formularios de búsqueda y de publicación no lo leen directo: usan services/catalogos.js, que
// muestra el catálogo del backend (o su última copia válida) y recurre a este solo si no hay otro.
// También es la lista de nombres históricos que siguen resolviéndose: las publicaciones y alertas
// guardan el nombre del barrio y de la categoría, así que no se renombra ni se quita nada.
// El centro de cada barrio es una referencia para ordenar por cercanía, no la posición de un suceso.
// Debe coincidir con CATEGORIES y ZONES del backend (src/types.ts); las pruebas fijan la misma versión.
export const CATEGORIAS = [
  'Documentos',
  'Llaves',
  'Electrónica',
  'Mascotas',
  'Ropa',
  'Otros',
];

export const ZONAS = [
  {
    nombre: 'Centro',
    latitud: -34.6037,
    longitud: -58.3816,
  },
  {
    nombre: 'Palermo',
    latitud: -34.5889,
    longitud: -58.4306,
  },
  {
    nombre: 'Recoleta',
    latitud: -34.5875,
    longitud: -58.3937,
  },
  {
    nombre: 'Belgrano',
    latitud: -34.5628,
    longitud: -58.4567,
  },
  {
    nombre: 'Caballito',
    latitud: -34.6187,
    longitud: -58.4414,
  },
  {
    nombre: 'Almagro',
    latitud: -34.6111,
    longitud: -58.4206,
  },
];

// Radio de las búsquedas y alertas por GPS. Los límites son los de la API (0,1 a 500 km) y el valor
// inicial es su radio por defecto; el centro queda fijo, no se sigue al dispositivo.
export const RADIO_KM_MIN = 0.1;
export const RADIO_KM_MAX = 500;
export const RADIO_KM_INICIAL = 10;

export const MENSAJE_RADIO_INVALIDO =
  'El radio debe estar entre 0,1 y 500 km.';

export function radioValido(radio) {
  return (
    typeof radio === 'number' &&
    Number.isFinite(radio) &&
    radio >= RADIO_KM_MIN &&
    radio <= RADIO_KM_MAX
  );
}

// Radio que se aplica a unos filtros: solo existe con GPS (centro fijo más radio); un barrio
// es un filtro textual y no lleva radio. Sin radio elegido se usa el inicial de la API.
export function radioEfectivo(filtros) {
  if (!filtros.ubicacion) {
    return undefined;
  }

  return filtros.radioKm === undefined || filtros.radioKm === null
    ? RADIO_KM_INICIAL
    : filtros.radioKm;
}

// Acepta coma o punto decimal. Devuelve NaN si el texto no es un número.
export function parsearRadio(texto) {
  const limpio = String(texto).trim().replace(',', '.');

  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : NaN;
}

export function formatearRadio(radio) {
  return `${radio}`.replace('.', ',');
}

export const PERIODOS = [
  { valor: 'hoy', nombre: 'Hoy' },
  { valor: 'tresDias', nombre: 'Últimos 3 días' },
  { valor: 'semana', nombre: 'Última semana' },
  { valor: 'rango', nombre: 'Rango de fechas' },
];

export function fechaLocal(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

export function filtrosIniciales() {
  return {
    situacion: 'perdi',
    categoria: '',
    palabras: '',
    zona: '',
    periodo: 'semana',
    desde: fechaLocal(),
    hasta: fechaLocal(),
    ubicacion: null,
  };
}

export function fechaValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }

  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);

  return (
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia
  );
}

export function validarFiltros(filtros) {
  if (!filtros.categoria) {
    return 'Elegí una categoría.';
  }

  if (!filtros.zona && !filtros.ubicacion) {
    return 'Elegí un barrio o una localidad.';
  }

  if (filtros.periodo === 'rango') {
    if (
      !fechaValida(filtros.desde) ||
      !fechaValida(filtros.hasta)
    ) {
      return 'Ingresá fechas válidas con formato AAAA-MM-DD.';
    }

    if (filtros.desde > filtros.hasta) {
      return 'La fecha inicial no puede ser posterior a la final.';
    }

    if (filtros.hasta > fechaLocal()) {
      return 'La fecha final no puede ser futura.';
    }
  }

  if (filtros.ubicacion && !radioValido(radioEfectivo(filtros))) {
    return MENSAJE_RADIO_INVALIDO;
  }

  return '';
}

export function resumenBusqueda(filtros) {
  const situacion =
    filtros.situacion === 'perdi'
      ? 'Perdí algo'
      : 'Encontré algo';

  const periodo = PERIODOS.find(
    (item) => item.valor === filtros.periodo
  )?.nombre;

  const fechas =
    filtros.periodo === 'rango'
      ? `${filtros.desde} a ${filtros.hasta}`
      : periodo;

  const zona = filtros.zona || resumenUbicacion(filtros);

  const palabras = filtros.palabras.trim()
    ? ` · ${filtros.palabras.trim()}`
    : '';

  return `${situacion} · ${filtros.categoria} · ${zona} · ${fechas}${palabras}`;
}

function coordenadas(ubicacion) {
  return `${ubicacion.latitud.toFixed(3)}, ${ubicacion.longitud.toFixed(3)}`;
}

function resumenUbicacion(filtros) {
  const { ubicacion } = filtros;

  return ubicacion
    ? `Mi ubicación (${coordenadas(ubicacion)}) · radio ${formatearRadio(radioEfectivo(filtros))} km`
    : 'Mi ubicación';
}

export function claveBusqueda(filtros) {
  return JSON.stringify([
    filtros.situacion,
    filtros.categoria,
    normalizar(filtros.palabras.trim()),
    filtros.zona,
    filtros.periodo,
    filtros.periodo === 'rango' ? filtros.desde : '',
    filtros.periodo === 'rango' ? filtros.hasta : '',
    filtros.ubicacion
      ? [filtros.ubicacion.latitud, filtros.ubicacion.longitud]
      : null,
    radioEfectivo(filtros) ?? null,
  ]);
}

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
