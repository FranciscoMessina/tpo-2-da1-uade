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

  const zona = filtros.zona || 'Mi ubicación';

  const palabras = filtros.palabras.trim()
    ? ` · ${filtros.palabras.trim()}`
    : '';

  return `${situacion} · ${filtros.categoria} · ${zona} · ${fechas}${palabras}`;
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
    filtros.ubicacion,
  ]);
}

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
