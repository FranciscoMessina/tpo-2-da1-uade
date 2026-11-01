import PublicacionesPendientes from '../components/PublicacionesPendientes';
import { Pantalla } from '../components/ui';

export default function PublicacionesPendientesScreen({ navigation }) {
  return (
    <Pantalla>
      <PublicacionesPendientes navigation={navigation} mostrarVacio />
    </Pantalla>
  );
}
