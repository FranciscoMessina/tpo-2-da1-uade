import { StyleSheet, View } from 'react-native';
import Icono from './Icono';
import Texto from './Texto';
import { espacio, radios, tonos } from './tema';

export const ESTADOS_PUBLICACION = {
  abierta: { texto: 'Abierta', tono: 'exito' },
  en_reclamo: { texto: 'En reclamo', tono: 'aviso' },
  resuelta: { texto: 'Resuelta', tono: 'neutro' },
  vencida: { texto: 'Vencida', tono: 'peligro' },
};

export const ESTADOS_RECLAMO = {
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  aceptado: { texto: 'Aceptado', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'neutro' },
  cancelado: { texto: 'Cancelado', tono: 'neutro' },
  vencido: { texto: 'Vencido (48 hs)', tono: 'peligro' },
};

const ICONOS_CATEGORIA = {
  Documentos: 'card-account-details-outline',
  Llaves: 'key-variant',
  Electrónica: 'headphones',
  Mascotas: 'paw',
  Ropa: 'tshirt-crew-outline',
  Otros: 'bag-personal-outline',
};

export function iconoCategoria(categoria) {
  return ICONOS_CATEGORIA[categoria] ?? 'package-variant-closed';
}

// Texto corto con el color de su significado: estados, tipos y novedades
export function Insignia({ texto, tono = 'neutro', icono = undefined }) {
  const { fondo, texto: color } = tonos[tono];

  return (
    <View style={[styles.insignia, { backgroundColor: fondo }]}>
      {!!icono && <Icono nombre={icono} tamano={14} color={color} />}
      <Texto variante="leyendaFuerte" style={{ color }}>{texto}</Texto>
    </View>
  );
}

export function InsigniaTipo({ tipo }) {
  const encontrado = tipo === 'encontrado';

  return <Insignia texto={encontrado ? 'Encontrado' : 'Perdido'} tono={encontrado ? 'info' : 'neutro'} />;
}

/** @param {{ estado: string, estados?: Record<string, { texto: string, tono: string }> }} props */
export function InsigniaEstado({ estado, estados = ESTADOS_PUBLICACION }) {
  const definido = estados[estado] ?? { texto: estado, tono: 'neutro' };

  return <Insignia texto={definido.texto} tono={definido.tono} />;
}

const styles = StyleSheet.create({
  insignia: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacio.xxs,
    paddingHorizontal: 10,
    paddingVertical: espacio.xxs,
    borderRadius: radios.pastilla,
  },
});
