// Franjas horarias del suceso. El servidor las deriva de la hora (6:00 a 11:59 mañana, 12:00 a
// 18:59 tarde, el resto noche); acá solo están las etiquetas para mostrarlas.
export const FRANJAS = [
  { valor: 'manana', nombre: 'Mañana (6 a 12 h)' },
  { valor: 'tarde', nombre: 'Tarde (12 a 19 h)' },
  { valor: 'noche', nombre: 'Noche (19 a 6 h)' },
];

/** Etiqueta de una franja; si no se conoce, el valor tal cual. */
export function nombreFranja(valor) {
  return FRANJAS.find((franja) => franja.valor === valor)?.nombre ?? valor ?? '';
}

/** Hora para mostrar: «18:30 h», o '' si no hay. */
export function textoHora(hora) {
  return typeof hora === 'string' && /^\d{2}:\d{2}$/.test(hora) ? `${hora} h` : '';
}
