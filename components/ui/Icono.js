import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { colores } from './tema';

// Único punto de contacto con la librería de íconos. Son decorativos para el lector de
// pantalla: el nombre accesible lo da el control que los contiene.
export default function Icono({ nombre, tamano = 20, color = colores.texto, style = undefined }) {
  return (
    <MaterialDesignIcons
      name={nombre}
      size={tamano}
      color={color}
      style={style}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
