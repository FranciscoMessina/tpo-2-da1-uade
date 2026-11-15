import { useState } from 'react';
import { Alert } from 'react-native';
import useConfiguracion from '../hooks/useConfiguracion';
import { useEstadoRegistroPush } from '../hooks/useRegistroPush';
import { useEstadoRespaldo } from '../hooks/useRespaldoSegundoPlano';
import { probarRespaldoAhora } from '../services/respaldoSegundoPlano';
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
    mensaje: 'Este dispositivo no pudo obtener un token push (requiere una build con proyecto EAS y credenciales configuradas). Con la app abierta vas a ver los avisos igual; minimizada, solo por la revisión periódica de abajo, con demora.',
  },
  error_servidor: {
    tono: 'aviso',
    mensaje: 'El servidor no confirmó el registro. Se reintenta solo; mientras tanto los avisos llegan con la app abierta o, con demora, por la revisión periódica.',
  },
  rechazado: {
    tono: 'peligro',
    mensaje: 'El servidor rechazó el token de este dispositivo. Los avisos llegan con la app abierta o, con demora, por la revisión periódica.',
  },
};

function fechaLegible(iso) {
  const fecha = iso ? new Date(iso) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// Qué ve la persona sobre la revisión en segundo plano: si está programada y cuándo corrió.
// El sistema decide el momento; no se promete inmediatez.
function avisoRespaldo(estado) {
  if (!estado) return null;
  if (estado.disponible === false) {
    return {
      tono: 'aviso',
      mensaje: 'Este dispositivo no permite revisar novedades con la app cerrada. Vas a recibir los avisos por push o con la app abierta.',
    };
  }
  if (!estado.activo || !estado.registrada) {
    return estado.errorRegistro
      ? { tono: 'aviso', mensaje: `No se pudo programar la revisión con la app cerrada: ${estado.errorRegistro}` }
      : null;
  }
  const ultima = fechaLegible(estado.ultimaEjecucion);
  return {
    tono: 'info',
    mensaje: 'Con la app minimizada, el sistema revisa novedades cada 15 minutos como mínimo (a veces bastante más, según batería y red) por si un aviso push no llegó. '
      + 'Si forzás la detención de Hallado desde los ajustes, no revisa hasta que la vuelvas a abrir.'
      + (ultima ? ` Última revisión: ${ultima}.` : ' Todavía no corrió ninguna revisión.'),
  };
}

export default function ConfiguracionScreen() {
  const { biometriaActiva, biometriaDisponible, setBiometria, loading, error } =
    useConfiguracion();
  const registro = useEstadoRegistroPush();
  const [programando, setProgramando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const { estado: respaldo, recargar: recargarRespaldo } = useEstadoRespaldo();
  const estadoRespaldo = avisoRespaldo(respaldo);
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

  const probarRespaldo = async () => {
    setRevisando(true);
    try {
      const { resultado, detalle } = await probarRespaldoAhora();
      Alert.alert(
        `Revisión manual: ${resultado}`,
        `${detalle}\n\nCorre la misma lógica que la tarea, pero desde la app abierta: no valida que el sistema la programe ni que corra con la app cerrada.`
      );
    } catch {
      Alert.alert('Error', 'No se pudo ejecutar la revisión.');
    } finally {
      setRevisando(false);
      recargarRespaldo();
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
        {estadoRespaldo && <Aviso tono={estadoRespaldo.tono} mensaje={estadoRespaldo.mensaje} />}
        {__DEV__ && respaldo && (
          <Texto variante="cuerpoChico" tono="secundario">
            {`Desarrollo · tarea ${respaldo.registrada ? 'registrada' : 'sin registrar'} · último resultado: ${respaldo.ultimoResultado ?? 'ninguno'}${respaldo.ultimoDetalle ? ` (${respaldo.ultimoDetalle})` : ''}`}
          </Texto>
        )}
        {__DEV__ && (
          <Boton
            titulo="Ejecutar revisión ahora (desarrollo)"
            icono="sync"
            variante="terciario"
            cargando={revisando}
            onPress={probarRespaldo}
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
