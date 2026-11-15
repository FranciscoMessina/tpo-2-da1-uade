import { useState } from 'react';
import { Alert } from 'react-native';
import useConfiguracion from '../hooks/useConfiguracion';
import { useEstadoRegistroPush } from '../hooks/useRegistroPush';
import {
  ESTADOS_REINTENTABLES,
  obtenerYRegistrarTokenPush,
  simularNotificacionLocal,
} from '../services/notificacionesPush';
import {
  Aviso,
  Boton,
  Cargando,
  FilaInterruptor,
  Pantalla,
  Seccion,
  Texto,
} from '../components/ui';

// Qué significa cada estado del registro para la persona
const ESTADOS_PUSH = {
  inactivo: { tono: 'neutro', mensaje: 'Todavía no se registró este dispositivo.' },
  registrando: { tono: 'info', mensaje: 'Registrando este dispositivo…' },
  registrado: {
    tono: 'exito',
    mensaje: 'Dispositivo registrado: el servidor envía avisos de reclamos, puntos de encuentro y devoluciones a este teléfono.',
  },
  sin_permiso: {
    tono: 'aviso',
    mensaje: 'Las notificaciones están desactivadas. Habilitalas en los ajustes del sistema para recibir avisos.',
  },
  no_disponible: {
    tono: 'aviso',
    mensaje: 'Este dispositivo no pudo obtener un token push (requiere una build con proyecto EAS y credenciales configuradas). Con la app abierta vas a ver los avisos igual; con la app cerrada, no.',
  },
  error_servidor: {
    tono: 'aviso',
    mensaje: 'El servidor no confirmó el registro. Se reintenta solo; mientras tanto los avisos llegan solo con la app abierta.',
  },
  rechazado: {
    tono: 'peligro',
    mensaje: 'El servidor rechazó el token de este dispositivo. Los avisos llegan solo con la app abierta.',
  },
};

export default function ConfiguracionScreen() {
  const { biometriaActiva, biometriaDisponible, setBiometria, loading, error } =
    useConfiguracion();
  const registro = useEstadoRegistroPush();
  const [programando, setProgramando] = useState(false);
  const estadoPush = ESTADOS_PUSH[registro.estado] ?? ESTADOS_PUSH.inactivo;

  const probarAvisoLocal = async () => {
    setProgramando(true);
    try {
      await simularNotificacionLocal({ segundos: 5 });
      Alert.alert(
        'Aviso local programado',
        'En 5 segundos este dispositivo mostrará una notificación generada localmente. No pasa por el servidor: sirve para probar el canal y la navegación, no la entrega push.'
      );
    } catch {
      Alert.alert('Error', 'No se pudo programar el aviso local.');
    } finally {
      setProgramando(false);
    }
  };

  if (loading) return <Cargando pantalla />;

  return (
    <Pantalla>
      <Seccion titulo="Seguridad">
        <FilaInterruptor
          etiqueta="Desbloquear con biometría"
          valor={biometriaActiva}
          onChange={setBiometria}
          disabled={!biometriaDisponible}
        />

        <Texto variante="cuerpoChico" tono="secundario">
          {biometriaDisponible
            ? 'Se te pedirá huella o rostro al abrir la app o volver a ella.'
            : 'Tu dispositivo no tiene biometría disponible o no hay huella/rostro configurados.'}
        </Texto>

        {error !== '' && <Aviso tono="peligro" mensaje={error} />}
      </Seccion>

      <Seccion titulo="Notificaciones">
        <Texto variante="cuerpoChico" tono="secundario">
          Hallado te avisa con notificaciones del sistema ante reclamos nuevos o que cambian de estado, puntos de encuentro y devoluciones.
        </Texto>
        <Aviso tono={estadoPush.tono} mensaje={estadoPush.mensaje} />
        {ESTADOS_REINTENTABLES.has(registro.estado) && (
          <Boton
            titulo="Reintentar registro"
            icono="refresh"
            variante="secundario"
            onPress={() => obtenerYRegistrarTokenPush({ pedirPermiso: true })}
          />
        )}
        {__DEV__ && (
          <Boton
            titulo="Probar aviso local (desarrollo)"
            icono="bell-ring-outline"
            variante="terciario"
            cargando={programando}
            onPress={probarAvisoLocal}
          />
        )}
      </Seccion>
    </Pantalla>
  );
}
