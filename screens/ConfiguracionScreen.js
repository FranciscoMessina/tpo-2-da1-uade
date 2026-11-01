import useConfiguracion from '../hooks/useConfiguracion';
import {
  Aviso,
  Cargando,
  FilaInterruptor,
  Pantalla,
  Seccion,
  Texto,
} from '../components/ui';

export default function ConfiguracionScreen() {
  const { biometriaActiva, biometriaDisponible, setBiometria, loading, error } =
    useConfiguracion();

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
    </Pantalla>
  );
}
