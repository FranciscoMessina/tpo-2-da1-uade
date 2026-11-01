import { Text } from 'react-native';
import { colores, tipografia, tonos } from './tema';

const COLORES = {
  principal: colores.texto,
  secundario: colores.textoSecundario,
  tenue: colores.textoTenue,
  primario: colores.primario,
  inverso: colores.textoInverso,
  peligro: tonos.peligro.texto,
  aviso: tonos.aviso.texto,
  exito: tonos.exito.texto,
};

// Texto con un rol de la escala tipográfica y un color del tema
export default function Texto({
  variante = 'cuerpo',
  tono = 'principal',
  centrado = false,
  style = undefined,
  ...props
}) {
  return (
    <Text
      style={[
        tipografia[variante],
        { color: COLORES[tono] },
        centrado && { textAlign: 'center' },
        style,
      ]}
      {...props}
    />
  );
}
