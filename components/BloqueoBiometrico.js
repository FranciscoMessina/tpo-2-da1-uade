import { StyleSheet, View } from 'react-native';
import useBloqueoBiometrico from '../hooks/useBloqueoBiometrico';
import { Boton, EstadoVacio, colores, espacio } from './ui';

export default function BloqueoBiometrico() {
  const { bloqueado, autenticando, error, desbloquear } =
    useBloqueoBiometrico();

  if (!bloqueado) return null;

  return (
    <View style={styles.overlay}>
      <EstadoVacio
        icono="lock-outline"
        titulo="Hallado está bloqueada"
        mensaje={error !== '' ? error : 'Usá la biometría de tu dispositivo para continuar.'}
      >
        <Boton
          titulo={autenticando ? 'Verificando...' : 'Reintentar'}
          cargando={autenticando}
          onPress={desbloquear}
        />
      </EstadoVacio>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colores.fondo,
    justifyContent: 'center',
    padding: espacio.lg,
    zIndex: 1000,
    elevation: 1000,
  },
});
