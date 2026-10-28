import {
  guardarUltimosReclamos,
  obtenerUltimosReclamos,
} from '../services/cacheOffline';
import { useConexion } from '../context/ConexionContext';
import { verificarConexion } from '../services/conexion';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  obtenerMisReclamos,
  aceptarReclamo,
  rechazarReclamo,
} from '../services/publicaciones';
import { API_URL, mensajeErrorApi } from '../services/api';
import EncuentroReclamo from '../components/EncuentroReclamo';

const ESTADOS_RECLAMO = {
  pendiente: { texto: 'Pendiente', fondo: '#FEF3C7', color: '#92400E' },
  aceptado: { texto: 'Aceptado', fondo: '#DCFCE7', color: '#166534' },
  rechazado: { texto: 'Rechazado', fondo: '#E5E7EB', color: '#374151' },
  vencido: { texto: 'Vencido (48 hs)', fondo: '#FEE2E2', color: '#991B1B' },
};

function extraerFotoUrl(mensaje) {
  if (!mensaje) return null;
  const match = mensaje.match(
    /Foto (?:del hallazgo|de comprobación):\s*(\/uploads\/[^\s]+)/
  );
  return match ? match[1] : null;
}

export default function MisReclamosScreen({ navigation }) {
  const { hayConexion } = useConexion();
  const [tab, setTab] = useState('recibidos'); // 'recibidos' | 'enviados'
  const [reclamosEnviados, setReclamosEnviados] = useState([]);
  const [reclamosRecibidos, setReclamosRecibidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [error, setError] = useState('');
  const [actualizacion, setActualizacion] = useState(0);

  const cargar = useCallback(async () => {
    setError('');
    const online = await verificarConexion();
    if (!online) {
      const cache = await obtenerUltimosReclamos();
      if (cache && (cache.enviados.length > 0 || cache.recibidos.length > 0)) {
        setReclamosEnviados(cache.enviados);
        setReclamosRecibidos(cache.recibidos);
        setActualizacion((n) => n + 1);
        setError('');
      } else {
        setError('No hay conexión a internet y no hay reclamos guardados previamente en el dispositivo.');
      }
      setCargando(false);
      return;
    }

    try {
      const [resEnviados, resRecibidos] = await Promise.all([
        obtenerMisReclamos({ tipo: 'enviados' }),
        obtenerMisReclamos({ tipo: 'recibidos' }),
      ]);
      const env = resEnviados.items || [];
      const rec = resRecibidos.items || [];
      setReclamosEnviados(env);
      setReclamosRecibidos(rec);
      setActualizacion((n) => n + 1);
      // Guardar copia local para visualización sin conexión
      await guardarUltimosReclamos({ enviados: env, recibidos: rec });
    } catch (e) {
      const cache = await obtenerUltimosReclamos();
      if (cache && (cache.enviados.length > 0 || cache.recibidos.length > 0)) {
        setReclamosEnviados(cache.enviados);
        setReclamosRecibidos(cache.recibidos);
        setActualizacion((n) => n + 1);
        setError('');
      } else {
        setError(mensajeErrorApi(e));
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  function manejarAceptar(reclamo) {
    Alert.alert(
      'Aceptar reclamo',
      `¿Querés aceptar el reclamo de ${reclamo.usuario}? La publicación pasará a estado "En reclamo" para coordinar la devolución.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setProcesandoId(reclamo.id);
            try {
              await aceptarReclamo(reclamo.id);
              Alert.alert(
                'Reclamo aceptado',
                'El reclamo fue aceptado. Podés coordinar la entrega con la otra persona.'
              );
              cargar();
            } catch (err) {
              Alert.alert('No se pudo aceptar', mensajeErrorApi(err));
            } finally {
              setProcesandoId(null);
            }
          },
        },
      ]
    );
  }

  function manejarRechazar(reclamo) {
    Alert.alert(
      'Rechazar reclamo',
      `¿Querés rechazar el reclamo de ${reclamo.usuario}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setProcesandoId(reclamo.id);
            try {
              await rechazarReclamo(reclamo.id);
              Alert.alert('Reclamo rechazado', 'El reclamo fue rechazado.');
              cargar();
            } catch (err) {
              Alert.alert('No se pudo rechazar', mensajeErrorApi(err));
            } finally {
              setProcesandoId(null);
            }
          },
        },
      ]
    );
  }

  const items = tab === 'recibidos' ? reclamosRecibidos : reclamosEnviados;

  function renderItem({ item }) {
    const estadoConfig = ESTADOS_RECLAMO[item.estado] || {
      texto: item.estado,
      fondo: '#E5E7EB',
      color: '#374151',
    };
    const fotoAdjunta = extraerFotoUrl(item.mensaje);
    const pub = item.publicacion;
    const esRecibido = tab === 'recibidos';

    return (
      <View style={styles.card}>
        {/* Cabecera con publicación vinculada */}
        {pub && (
          <Pressable
            style={styles.pubHeader}
            onPress={() =>
              navigation.navigate('DetallePublicacion', {
                publicacionId: pub.id,
              })
            }
          >
            <View style={styles.pubInfo}>
              <Text style={styles.pubTipo}>
                {pub.tipo === 'encontrado' ? 'OBJETO ENCONTRADO' : 'OBJETO PERDIDO'}
              </Text>
              <Text style={styles.pubTitulo} numberOfLines={1}>
                {pub.titulo}
              </Text>
              <Text style={styles.pubDetalles}>
                {pub.categoria} · {pub.barrio}
              </Text>
            </View>
            <Text style={styles.verFlecha}>›</Text>
          </Pressable>
        )}

        {/* Separador */}
        <View style={styles.divisor} />

        {/* Datos del reclamo */}
        <View style={styles.claimRow}>
          <Text style={styles.claimUser}>
            {esRecibido ? `De: ${item.usuario}` : 'Enviado por vos'}
          </Text>
          <View
            style={[
              styles.estadoBadge,
              { backgroundColor: estadoConfig.fondo },
            ]}
          >
            <Text style={[styles.estadoTexto, { color: estadoConfig.color }]}>
              {estadoConfig.texto}
            </Text>
          </View>
        </View>

        <Text style={styles.intentosTexto}>
          Intento {item.intentos || 1} de {item.maxIntentos || 3}
        </Text>

        {/* Mensaje del reclamo */}
        <Text style={styles.mensaje}>{item.mensaje}</Text>

        {/* Foto adjunta en el reclamo */}
        {fotoAdjunta && (
          <Image
            source={{ uri: `${API_URL}${fotoAdjunta}` }}
            style={styles.fotoAdjunta}
            resizeMode="cover"
          />
        )}

        {/* Teléfono compartido en caso de aceptación */}
        {item.estado === 'aceptado' && (
          <View style={styles.infoBoxAceptado}>
            <Text style={styles.infoBoxAceptadoTexto}>
              {item.telefono
                ? `📞 Teléfono de contacto: ${item.telefono}`
                : 'Esta persona prefiere comunicarse mediante la aplicación.'}
            </Text>
          </View>
        )}

        {item.estado === 'aceptado' && pub?.estado === 'en_reclamo' && (
          <EncuentroReclamo reclamoId={item.id} actualizacion={actualizacion} />
        )}

        {/* Aviso de vencimiento */}
        {item.estado === 'vencido' && (
          <View style={styles.infoBoxVencido}>
            <Text style={styles.infoBoxVencidoTexto}>
              ⏰ Venció automáticamente al cumplirse 48 hs sin respuesta.
            </Text>
          </View>
        )}

        {/* Acciones para el publicador en reclamos recibidos */}
        {esRecibido && item.estado === 'pendiente' && pub?.estado === 'abierta' && (
          <>
            <View style={styles.accionesFila}>
              <View style={styles.botonAccion}>
                <Button
                  title={procesandoId === item.id ? 'Aceptando…' : 'Aceptar'}
                  color={!hayConexion ? '#9CA3AF' : undefined}
                  disabled={procesandoId === item.id || !hayConexion}
                  onPress={() => manejarAceptar(item)}
                />
              </View>
              <View style={styles.botonAccion}>
                <Button
                  title={procesandoId === item.id ? 'Rechazando…' : 'Rechazar'}
                  color={!hayConexion ? '#9CA3AF' : '#DC2626'}
                  disabled={procesandoId === item.id || !hayConexion}
                  onPress={() => manejarRechazar(item)}
                />
              </View>
            </View>
            {!hayConexion && (
              <View style={styles.avisoAccionOffline}>
                <Text style={styles.avisoAccionOfflineTexto}>
                  ⚠️ Se necesita conexión para aceptar o rechazar este reclamo.
                </Text>
              </View>
            )}
          </>
        )}

        {/* Botón para ver publicación si es enviado o ya resuelto */}
        {pub && (
          <View style={styles.verPubContainer}>
            <Button
              title="Ver publicación"
              color="#4B5563"
              onPress={() =>
                navigation.navigate('DetallePublicacion', {
                  publicacionId: pub.id,
                })
              }
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {!hayConexion && (
        <View style={styles.bannerOffline}>
          <Text style={styles.bannerOfflineIcon}>⚠️</Text>
          <View style={styles.bannerOfflineTexto}>
            <Text style={styles.bannerOfflineTitulo}>Modo sin conexión</Text>
            <Text style={styles.bannerOfflineMensaje}>
              Mostrando los últimos reclamos cargados. Se necesita conexión a internet para aceptar o rechazar reclamos.
            </Text>
          </View>
        </View>
      )}
      {/* Selector de solapas */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'recibidos' && styles.tabActiva]}
          onPress={() => setTab('recibidos')}
        >
          <Text
            style={[
              styles.tabTexto,
              tab === 'recibidos' && styles.tabTextoActivo,
            ]}
          >
            Recibidos ({reclamosRecibidos.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, tab === 'enviados' && styles.tabActiva]}
          onPress={() => setTab('enviados')}
        >
          <Text
            style={[
              styles.tabTexto,
              tab === 'enviados' && styles.tabTextoActivo,
            ]}
          >
            Enviados ({reclamosEnviados.length})
          </Text>
        </Pressable>
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTexto}>{error}</Text>
          <Button title="Reintentar" onPress={cargar} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={cargando} onRefresh={cargar} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>
                {tab === 'recibidos' ? '📥' : '📤'}
              </Text>
              <Text style={styles.emptyTitle}>
                {tab === 'recibidos'
                  ? 'No recibiste reclamos'
                  : 'No enviaste reclamos'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'recibidos'
                  ? 'Cuando alguien reclame un objeto en tus publicaciones, lo vas a ver acá.'
                  : 'Cuando reclames un objeto perdido o encontrado, podrás seguir su estado acá.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActiva: {
    borderBottomColor: '#1D4ED8',
  },
  tabTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextoActivo: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTexto: {
    fontSize: 15,
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  pubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pubInfo: {
    flex: 1,
    gap: 2,
  },
  pubTipo: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1D4ED8',
  },
  pubTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  pubDetalles: {
    fontSize: 13,
    color: '#6B7280',
  },
  verFlecha: {
    fontSize: 24,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  divisor: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  claimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  claimUser: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
  },
  estadoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  estadoTexto: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  intentosTexto: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  mensaje: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  fotoAdjunta: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  infoBoxAceptado: {
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 8,
  },
  infoBoxAceptadoTexto: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
  },
  infoBoxVencido: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
  },
  infoBoxVencidoTexto: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },
  accionesFila: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  botonAccion: {
    flex: 1,
  },
  verPubContainer: {
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  bannerOffline: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    margin: 16,
    marginBottom: 0,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerOfflineIcon: {
    fontSize: 22,
  },
  bannerOfflineTexto: {
    flex: 1,
  },
  bannerOfflineTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 2,
  },
  bannerOfflineMensaje: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  avisoAccionOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  avisoAccionOfflineTexto: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    textAlign: 'center',
  },
});