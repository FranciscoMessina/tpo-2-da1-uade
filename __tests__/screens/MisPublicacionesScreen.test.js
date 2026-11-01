import { render, screen } from '@testing-library/react-native';
import MisPublicacionesScreen from '../../screens/MisPublicacionesScreen';
import { __navegacion as navegacion } from '@react-navigation/native';

// El listado tiene sus propios datos y pruebas; acá solo se comprueba que la pantalla lo monta.
jest.mock('../../components/MisPublicaciones', () => {
  const { Text } = require('react-native');
  return function MisPublicacionesDoble() {
    return <Text>Listado de mis publicaciones</Text>;
  };
});

describe('MisPublicacionesScreen', () => {
  test('muestra el listado de publicaciones propias', () => {
    render(<MisPublicacionesScreen navigation={navegacion} />);

    expect(screen.getByText('Listado de mis publicaciones')).toBeTruthy();
  });
});
