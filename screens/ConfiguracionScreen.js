import { useState } from 'react';
import { Alert } from 'react-native';
import useConfiguracion from '../hooks/useConfiguracion';
import { simularNotificacionNativa } from '../services/notificacionesPush';
import {
  Aviso,
  Boton,
  Cargando,
  FilaInterruptor,
  Pantalla,
  Seccion,
  Texto,
} from '../components/ui';

export default function ConfiguracionScreen() {
  const { biometriaActiva, biometriaDisponible, setBiometria, loading, error } =
    useConfiguracion();
  const [programando, setProgramando] = useState(false);

  const probarNotificacion = async () => {
    setProgramando(true);
    try {
      await simularNotificacionNativa({
        segundos: 5,
        titulo: 'Reclamo recibido',
        mensaje: 'Alguien reclamó tu publicación «Mochila negra en biblioteca»',
        datos: {
          tipo: 'reclamo',
          claimId: 'demo-reclamo-1',
        },
      });
      Alert.alert(
        'Notificación programada',
        'En 5 segundos llegará una notificación push al sistema. Minimizá la app ahora para verificar que llega en segundo plano y que al tocarla abre directamente la pantalla del reclamo.'
      );
    } catch {
      Alert.alert('Error', 'No se pudo programar la notificación de prueba.');
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

      <Seccion titulo="Notificaciones Push">
        <Texto variante="cuerpoChico" tono="secundario">
          Hallado te avisa mediante notificaciones del sistema ante reclamos nuevos, cambios de estado y coordinación de puntos de encuentro, aun cuando la app no está abierta.
        </Texto>
        <Boton
          titulo="Probar notificación en 5 segundos"
          icono="bell-ring-outline"
          variante="secundario"
          cargando={programando}
          onPress={probarNotificacion}
        />
      </Seccion>
    </Pantalla>
  );
}
