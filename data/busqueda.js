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
  { nombre: 'Centro', latitud: -34.6037, longitud: -58.3816 },
  { nombre: 'Palermo', latitud: -34.5889, longitud: -58.4306 },
  { nombre: 'Recoleta', latitud: -34.5875, longitud: -58.3937 },
  { nombre: 'Belgrano', latitud: -34.5628, longitud: -58.4567 },
  { nombre: 'Caballito', latitud: -34.6187, longitud: -58.4414 },
  { nombre: 'Almagro', latitud: -34.6111, longitud: -58.4206 },
  // Barrios oficiales de CABA (el centro es aproximado).
  { nombre: 'Agronomía', latitud: -34.5936, longitud: -58.4905 },
  { nombre: 'Balvanera', latitud: -34.6094, longitud: -58.4003 },
  { nombre: 'Barracas', latitud: -34.6445, longitud: -58.3697 },
  { nombre: 'Boedo', latitud: -34.6285, longitud: -58.4180 },
  { nombre: 'Chacarita', latitud: -34.5879, longitud: -58.4540 },
  { nombre: 'Coghlan', latitud: -34.5600, longitud: -58.4750 },
  { nombre: 'Colegiales', latitud: -34.5740, longitud: -58.4490 },
  { nombre: 'Constitución', latitud: -34.6270, longitud: -58.3830 },
  { nombre: 'Flores', latitud: -34.6280, longitud: -58.4620 },
  { nombre: 'Floresta', latitud: -34.6310, longitud: -58.4850 },
  { nombre: 'La Boca', latitud: -34.6345, longitud: -58.3630 },
  { nombre: 'La Paternal', latitud: -34.5980, longitud: -58.4690 },
  { nombre: 'Liniers', latitud: -34.6430, longitud: -58.5190 },
  { nombre: 'Mataderos', latitud: -34.6600, longitud: -58.5030 },
  { nombre: 'Monte Castro', latitud: -34.6170, longitud: -58.5040 },
  { nombre: 'Montserrat', latitud: -34.6120, longitud: -58.3790 },
  { nombre: 'Nueva Pompeya', latitud: -34.6500, longitud: -58.4130 },
  { nombre: 'Núñez', latitud: -34.5450, longitud: -58.4630 },
  { nombre: 'Parque Avellaneda', latitud: -34.6480, longitud: -58.4750 },
  { nombre: 'Parque Chacabuco', latitud: -34.6350, longitud: -58.4350 },
  { nombre: 'Parque Chas', latitud: -34.5860, longitud: -58.4780 },
  { nombre: 'Parque Patricios', latitud: -34.6370, longitud: -58.4000 },
  { nombre: 'Puerto Madero', latitud: -34.6118, longitud: -58.3636 },
  { nombre: 'Retiro', latitud: -34.5920, longitud: -58.3740 },
  { nombre: 'Saavedra', latitud: -34.5530, longitud: -58.4850 },
  { nombre: 'San Cristóbal', latitud: -34.6240, longitud: -58.4000 },
  { nombre: 'San Nicolás', latitud: -34.6040, longitud: -58.3880 },
  { nombre: 'San Telmo', latitud: -34.6210, longitud: -58.3720 },
  { nombre: 'Vélez Sársfield', latitud: -34.6360, longitud: -58.4890 },
  { nombre: 'Versalles', latitud: -34.6290, longitud: -58.5190 },
  { nombre: 'Villa Crespo', latitud: -34.5990, longitud: -58.4380 },
  { nombre: 'Villa del Parque', latitud: -34.6100, longitud: -58.4860 },
  { nombre: 'Villa Devoto', latitud: -34.6000, longitud: -58.5120 },
  { nombre: 'Villa General Mitre', latitud: -34.6060, longitud: -58.4690 },
  { nombre: 'Villa Lugano', latitud: -34.6870, longitud: -58.4670 },
  { nombre: 'Villa Luro', latitud: -34.6350, longitud: -58.5050 },
  { nombre: 'Villa Ortúzar', latitud: -34.5780, longitud: -58.4680 },
  { nombre: 'Villa Pueyrredón', latitud: -34.5800, longitud: -58.5050 },
  { nombre: 'Villa Real', latitud: -34.6170, longitud: -58.5210 },
  { nombre: 'Villa Riachuelo', latitud: -34.6840, longitud: -58.4620 },
  { nombre: 'Villa Santa Rita', latitud: -34.6130, longitud: -58.4780 },
  { nombre: 'Villa Soldati', latitud: -34.6680, longitud: -58.4400 },
  { nombre: 'Villa Urquiza', latitud: -34.5730, longitud: -58.4890 },
  // Localidades del Gran Buenos Aires.
  { nombre: 'Vicente López', latitud: -34.5270, longitud: -58.4750 },
  { nombre: 'Olivos', latitud: -34.5100, longitud: -58.4890 },
  { nombre: 'Florida', latitud: -34.5280, longitud: -58.4890 },
  { nombre: 'Munro', latitud: -34.5300, longitud: -58.5200 },
  { nombre: 'San Isidro', latitud: -34.4710, longitud: -58.5270 },
  { nombre: 'Martínez', latitud: -34.4920, longitud: -58.5030 },
  { nombre: 'Boulogne', latitud: -34.4980, longitud: -58.5600 },
  { nombre: 'Beccar', latitud: -34.4570, longitud: -58.5280 },
  { nombre: 'Tigre', latitud: -34.4260, longitud: -58.5800 },
  { nombre: 'Don Torcuato', latitud: -34.4960, longitud: -58.6170 },
  { nombre: 'San Fernando', latitud: -34.4420, longitud: -58.5610 },
  { nombre: 'San Martín', latitud: -34.5790, longitud: -58.5370 },
  { nombre: 'Villa Ballester', latitud: -34.5490, longitud: -58.5550 },
  { nombre: 'José León Suárez', latitud: -34.5330, longitud: -58.5810 },
  { nombre: 'Caseros', latitud: -34.6100, longitud: -58.5640 },
  { nombre: 'Ciudadela', latitud: -34.6360, longitud: -58.5400 },
  { nombre: 'Morón', latitud: -34.6530, longitud: -58.6200 },
  { nombre: 'Haedo', latitud: -34.6430, longitud: -58.5930 },
  { nombre: 'Castelar', latitud: -34.6520, longitud: -58.6490 },
  { nombre: 'Ituzaingó', latitud: -34.6600, longitud: -58.6670 },
  { nombre: 'Hurlingham', latitud: -34.5890, longitud: -58.6370 },
  { nombre: 'Merlo', latitud: -34.6650, longitud: -58.7270 },
  { nombre: 'Moreno', latitud: -34.6340, longitud: -58.7900 },
  { nombre: 'San Justo', latitud: -34.6810, longitud: -58.5620 },
  { nombre: 'Ramos Mejía', latitud: -34.6420, longitud: -58.5640 },
  { nombre: 'Avellaneda', latitud: -34.6620, longitud: -58.3650 },
  { nombre: 'Sarandí', latitud: -34.6830, longitud: -58.3420 },
  { nombre: 'Lanús', latitud: -34.7060, longitud: -58.3920 },
  { nombre: 'Banfield', latitud: -34.7430, longitud: -58.3980 },
  { nombre: 'Lomas de Zamora', latitud: -34.7600, longitud: -58.4040 },
  { nombre: 'Temperley', latitud: -34.7830, longitud: -58.3930 },
  { nombre: 'Adrogué', latitud: -34.7970, longitud: -58.3920 },
  { nombre: 'Quilmes', latitud: -34.7200, longitud: -58.2540 },
  { nombre: 'Bernal', latitud: -34.7130, longitud: -58.2800 },
  { nombre: 'Berazategui', latitud: -34.7640, longitud: -58.2120 },
  { nombre: 'Florencio Varela', latitud: -34.8130, longitud: -58.2790 },
  { nombre: 'Monte Grande', latitud: -34.8160, longitud: -58.4690 },
  { nombre: 'Ezeiza', latitud: -34.8550, longitud: -58.5230 },
  { nombre: 'Pilar', latitud: -34.4580, longitud: -58.9140 },
  { nombre: 'Escobar', latitud: -34.3480, longitud: -58.7940 },
  { nombre: 'San Miguel', latitud: -34.5430, longitud: -58.7120 },
  { nombre: 'La Plata', latitud: -34.9210, longitud: -57.9540 },
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
