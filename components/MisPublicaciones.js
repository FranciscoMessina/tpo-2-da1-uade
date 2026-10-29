import {
  ActivityIndicator,
  Button,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PublicacionesPendientes from './PublicacionesPendientes';
import useMisPublicaciones from '../hooks/useMisPublicaciones';
import {
  DIAS_AVISO_VENCIMIENTO,
  NOMBRE_ESTADO_PUBLICACION,
  diasParaVencer,
} from '../services/publicaciones';

const FILTROS = [
  { valor: '', nombre: 'Todas' },
  { valor: 'abierta', nombre: 'Abiertas' },
  { valor: 'en_reclamo', nombre: 'En reclamo' },
  { valor: 'resuelta', nombre: 'Resueltas' },
  { valor: 'vencida', nombre: 'Vencidas' },
];

function formatearFecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '';
}

// Aviso de vigencia: fecha si ya venció, o días restantes si falta poco (null si no corresponde)
function vigencia(publicacion) {
  if (publicacion.estado === 'vencida') {
    return `Venció el ${formatearFecha(publicacion.venceAt)}`;
  }

  const dias = diasParaVencer(publicacion.venceAt);
  if (
    ['abierta', 'en_reclamo'].includes(publicacion.estado) &&
    dias !== null &&
    dias <= DIAS_AVISO_VENCIMIENTO
  ) {
    return dias <= 0
      ? 'Vence hoy'
      : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'} (${formatearFecha(publicacion.venceAt)})`;
  }

  return null;
}

// Listado de las publicaciones propias; cada una abre su gestión.
export default function MisPublicaciones({ navigation }) {
  const {
    publicaciones,
    estado,
    cambiarEstado,
    total,
    hayMas,
    loading,
    refrescando,
    cargandoMas,
    error,
    errorMas,
    recargar,
    cargarMas,
  } = useMisPublicaciones();

  const porVencer = publicaciones.filter(
    (p) => p.estado !== 'vencida' && vigencia(p)
  ).length;

  return (
    <>
      <PublicacionesPendientes navigation={navigation} />

    <View style={styles.card}>
      <Text style={styles.title}>Mis publicaciones</Text>

      <View style={styles.filtros}>
        {FILTROS.map((filtro) => (
          <Pressable
            key={filtro.valor}
            onPress={() => cambiarEstado(filtro.valor)}
            style={[styles.chip, estado === filtro.valor && styles.chipActivo]}
            accessibilityRole="button"
            accessibilityState={{ selected: estado === filtro.valor }}
          >
            <Text
              style={[
                styles.chipTexto,
                estado === filtro.valor && styles.chipTextoActivo,
              ]}
            >
              {filtro.nombre}
            </Text>
          </Pressable>
        ))}
      </View>

      {porVencer > 0 && (
        <Text style={styles.aviso}>
          {porVencer === 1
            ? 'Tenés 1 publicación por vencer. Abrila para renovarla.'
            : `Tenés ${porVencer} publicaciones por vencer. Abrilas para renovarlas.`}
        </Text>
      )}

      {(loading || refrescando) && <ActivityIndicator color="#1D4ED8" />}

      {error !== '' && (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button title="Reintentar" onPress={recargar} />
        </>
      )}

      {!loading && error === '' && publicaciones.length === 0 && (
        <Text style={styles.empty}>
          {estado === ''
            ? 'Todavía no publicaste nada.'
            : 'No tenés publicaciones en este estado.'}
        </Text>
      )}

      {publicaciones.map((p) => {
        const aviso = vigencia(p);

        return (
          <Pressable
            key={p.id}
            style={styles.item}
            onPress={() =>
              navigation.navigate('GestionPublicacion', { publicacionId: p.id })
            }
            accessibilityRole="button"
          >
            <Text style={styles.itemTitle}>{p.titulo}</Text>
            <Text style={styles.itemMeta}>
              {p.tipo === 'encontrado' ? 'Encontrado' : 'Perdido'} ·{' '}
              {NOMBRE_ESTADO_PUBLICACION[p.estado] || p.estado} · {p.barrio}
            </Text>
            {aviso && <Text style={styles.itemAlerta}>{aviso}</Text>}
          </Pressable>
        );
      })}

      {errorMas !== '' && <Text style={styles.error}>{errorMas}</Text>}

      {hayMas && (
        <Button
          title={
            cargandoMas
              ? 'Cargando…'
              : `Ver más (${publicaciones.length} de ${total})`
          }
          disabled={cargandoMas}
          onPress={cargarMas}
        />
      )}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActivo: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipTexto: { color: '#111827' },
  chipTextoActivo: { color: '#FFFFFF' },
  aviso: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  item: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
  },
  itemTitle: { fontSize: 16, color: '#111827' },
  itemMeta: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  itemAlerta: { fontSize: 14, color: '#B45309', fontWeight: '600', marginTop: 2 },
  empty: { color: '#6B7280' },
  error: { color: '#DC2626', marginBottom: 8 },
});
