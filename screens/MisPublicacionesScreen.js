import MisPublicaciones from '../components/MisPublicaciones';
import { Pantalla } from '../components/ui';

export default function MisPublicacionesScreen({ navigation }) {
  return (
    <Pantalla>
      <MisPublicaciones navigation={navigation} />
    </Pantalla>
  );
}
