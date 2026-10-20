// Datos de prueba de "mis publicaciones" y reclamos. Solo deben importarlos los hooks.
// Al conectar el backend, este archivo se elimina.

export const tablaPublicaciones = [
  {
    id: 'pub-1',
    tipo: 'encontre',
    titulo: 'Llaves con llavero rojo',
    descripcion: 'Encontré un juego de tres llaves con llavero rojo en la plaza.',
    categoria: 'Llaves',
    barrio: 'Palermo',
    estado: 'abierta',
    direccionExacta: 'Plaza Italia, junto a la fuente, Palermo',
    fecha: '2026-10-18',
  },
  {
    id: 'pub-2',
    tipo: 'perdi',
    titulo: 'Billetera de cuero marrón',
    descripcion: 'Perdí mi billetera con documentos en el subte línea D.',
    categoria: 'Documentos',
    barrio: 'Recoleta',
    estado: 'abierta',
    direccionExacta: 'Av. Santa Fe 1800, Recoleta',
    fecha: '2026-10-15',
  },
  {
    id: 'pub-3',
    tipo: 'encontre',
    titulo: 'Gato atigrado',
    descripcion: 'Gato atigrado con collar azul, muy manso.',
    categoria: 'Mascotas',
    barrio: 'Caballito',
    estado: 'en_reclamo',
    direccionExacta: 'Av. Rivadavia 5200, Caballito',
    fecha: '2026-10-10',
  },
];

export const tablaReclamos = [
  {
    id: 'rec-1a',
    publicacionId: 'pub-1',
    usuario: 'Lucía Fernández',
    mensaje: 'Creo que son mías, el llavero tiene una L grabada.',
    permiteTelefono: true,
    telefono: '11 5555-1234',
    estado: 'pendiente',
  },
  {
    id: 'rec-1b',
    publicacionId: 'pub-1',
    usuario: 'Martín Gómez',
    mensaje: 'Perdí unas llaves ayer por esa zona.',
    permiteTelefono: false,
    telefono: '',
    estado: 'pendiente',
  },
  {
    id: 'rec-2a',
    publicacionId: 'pub-2',
    usuario: 'Sofía Ruiz',
    mensaje: 'Encontré una billetera parecida en la estación Pueyrredón.',
    permiteTelefono: true,
    telefono: '11 4444-9876',
    estado: 'pendiente',
  },
  {
    id: 'rec-3a',
    publicacionId: 'pub-3',
    usuario: 'Carla Díaz',
    mensaje: 'Es mi gato Tomás, tengo fotos para comprobarlo.',
    permiteTelefono: true,
    telefono: '11 3333-4567',
    estado: 'aceptado',
  },
];

export const tablaValoraciones = [];
