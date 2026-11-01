import { StyleSheet } from 'react-native';

/**
 * Tokens de diseño de Hallado. Es la única fuente de colores, espacios, radios y tipografía:
 * las pantallas no escriben valores sueltos. Reglas de uso en DESIGN.md.
 */

export const colores = {
  fondo: '#F3F4F6',
  superficie: '#FFFFFF',
  // Paneles dentro de una tarjeta: evita anidar tarjetas blancas
  superficieHundida: '#F3F4F6',
  borde: '#E5E7EB',
  // Contorno de controles: mantiene 3:1 sobre blanco (el gris 400 no llega)
  bordeControl: '#8A92A0',
  texto: '#111827',
  // Texto de ayuda: mantiene 4,5:1 también sobre el fondo gris
  textoSecundario: '#4B5563',
  // Solo sobre superficie blanca: placeholders y controles deshabilitados
  textoTenue: '#6B7280',
  textoInverso: '#FFFFFF',
  primario: '#1D4ED8',
  primarioPresionado: '#1E40AF',
  primarioSuave: '#DBEAFE',
  deshabilitado: '#E5E7EB',
  onda: 'rgba(17, 24, 39, 0.12)',
  ondaInversa: 'rgba(255, 255, 255, 0.24)',
  velo: 'rgba(17, 24, 39, 0.72)',
};

// Pares fondo/texto de cada significado. Todos superan 4,5:1.
export const tonos = {
  neutro: { fondo: '#E5E7EB', texto: '#374151' },
  info: { fondo: '#DBEAFE', texto: '#1E40AF' },
  exito: { fondo: '#DCFCE7', texto: '#166534' },
  aviso: { fondo: '#FEF3C7', texto: '#92400E' },
  peligro: { fondo: '#FEE2E2', texto: '#991B1B' },
};

export const espacio = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radios = {
  chico: 8,
  control: 12,
  tarjeta: 16,
  pastilla: 999,
};

// Roles tipográficos. La letra es la del sistema y sigue el tamaño elegido en el dispositivo.
export const tipografia = StyleSheet.create({
  pantalla: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  seccion: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  subtitulo: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  cuerpo: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  cuerpoChico: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  boton: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  leyenda: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  leyendaFuerte: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});

export const alturaControl = 48;

// Marco común de las pantallas y las listas
export const estilosPantalla = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: {
    padding: espacio.md,
    paddingBottom: espacio.lg,
    gap: espacio.sm,
  },
  centrado: {
    flex: 1,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espacio.lg,
    gap: espacio.sm,
  },
});
