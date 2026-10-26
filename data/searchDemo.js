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

  const zona = filtros.zona || 'Ubicación de ejemplo';

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

function distanciaKm(origen, destino) {
  const radianes = (valor) => (valor * Math.PI) / 180;

  const lat = radianes(
    destino.latitud - origen.latitud
  );

  const lon = radianes(
    destino.longitud - origen.longitud
  );

  const a =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radianes(origen.latitud)) *
      Math.cos(radianes(destino.latitud)) *
      Math.sin(lon / 2) ** 2;

  return (
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(Math.max(0, 1 - a))
    )
  );
}

export function buscarPublicaciones(
  publicaciones,
  filtros,
  orden,
  ahora = new Date()
) {
  const inicio = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate()
  );

  if (filtros.periodo === 'tresDias') {
    inicio.setDate(inicio.getDate() - 2);
  }

  if (filtros.periodo === 'semana') {
    inicio.setDate(inicio.getDate() - 6);
  }

  const desde =
    filtros.periodo === 'rango'
      ? filtros.desde
      : fechaLocal(inicio);

  const hasta =
    filtros.periodo === 'rango'
      ? filtros.hasta
      : fechaLocal(ahora);

  const origen =
    filtros.ubicacion ||
    ZONAS.find((zona) => zona.nombre === filtros.zona);

  const palabras = normalizar(filtros.palabras.trim())
    .split(/\s+/)
    .filter(Boolean);

  const tipoBuscado =
    filtros.situacion === 'perdi'
      ? 'encontrado'
      : 'perdido';

  return publicaciones
    .filter((publicacion) => {
      const texto = normalizar(
        `${publicacion.titulo} ${publicacion.descripcion}`
      );

      return (
        publicacion.tipo === tipoBuscado &&
        publicacion.categoria === filtros.categoria &&
        (!filtros.zona ||
          publicacion.barrio === filtros.zona) &&
        publicacion.fecha >= desde &&
        publicacion.fecha <= hasta &&
        palabras.every((palabra) => texto.includes(palabra))
      );
    })
    .map((publicacion) => ({
      ...publicacion,
      distancia: origen
        ? distanciaKm(origen, publicacion)
        : null,
    }))
    .sort((a, b) => {
      if (orden === 'cercanos') {
        return (
          (a.distancia ?? Infinity) -
            (b.distancia ?? Infinity) ||
          b.fecha.localeCompare(a.fecha)
        );
      }

      return (
        b.fecha.localeCompare(a.fecha) ||
        a.id.localeCompare(b.id)
      );
    });
}

export function crearPublicacionesEjemplo(
  ahora = new Date()
) {
  const ejemplos = [
    {
      categoria: 'Documentos',
      titulo: 'DNI a nombre de Ana',
      descripcion: 'Documento en un sobre azul.',
      icono: '🪪',
    },
    {
      categoria: 'Llaves',
      titulo: 'Llaves con llavero azul',
      descripcion: 'Tres llaves y un llavero azul.',
      icono: '🔑',
    },
    {
      categoria: 'Electrónica',
      titulo: 'Auriculares negros',
      descripcion: 'Auriculares inalámbricos con estuche.',
      icono: '🎧',
    },
    {
      categoria: 'Mascotas',
      titulo: 'Perro con collar rojo',
      descripcion: 'Perro mediano de pelo marrón.',
      icono: '🐕',
    },
    {
      categoria: 'Ropa',
      titulo: 'Campera negra',
      descripcion: 'Campera de abrigo talle M.',
      icono: '🧥',
    },
    {
      categoria: 'Otros',
      titulo: 'Mochila azul',
      descripcion: 'Mochila con cuadernos en su interior.',
      icono: '🎒',
    },
  ];

  return ejemplos.flatMap((ejemplo, categoriaIndice) =>
    ZONAS.flatMap((zona, zonaIndice) =>
      ['encontrado', 'perdido'].flatMap((tipo) =>
        Array.from({ length: 3 }, (_, indice) => {
          const fecha = new Date(
            ahora.getFullYear(),
            ahora.getMonth(),
            ahora.getDate() - indice
          );

          return {
            ...ejemplo,
            id: `demo-${categoriaIndice}-${zonaIndice}-${tipo}-${indice}`,
            tipo,
            barrio: zona.nombre,
            fecha: fechaLocal(fecha),
            titulo: `${ejemplo.titulo}${
              indice ? ` (${indice + 1})` : ''
            }`,
            latitud: zona.latitud + indice * 0.001,
            longitud: zona.longitud - indice * 0.001,
          };
        })
      )
    )
  );
}