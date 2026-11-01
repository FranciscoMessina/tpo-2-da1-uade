// Marca los momentos en que la app cede el primer plano a una pantalla del sistema (cámara,
// galería) y lo recupera enseguida. Android pasa la app a «background» mientras esa pantalla
// está abierta; sin esta marca, el bloqueo biométrico lo tomaba por una salida de la app.
let abiertas = 0;

export function hayActividadExterna() {
  return abiertas > 0;
}

/** Ejecuta `abrir` (p. ej. el selector de fotos) avisando que la salida de la app es esperada. */
export async function conActividadExterna(abrir) {
  abiertas += 1;
  try {
    return await abrir();
  } finally {
    abiertas -= 1;
  }
}
