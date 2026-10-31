import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import BloqueoBiometrico from '../../components/BloqueoBiometrico';
import useBloqueoBiometrico from '../../hooks/useBloqueoBiometrico';

// El estado del bloqueo se reemplaza: la prueba solo mira cómo se dibuja el overlay.
jest.mock('../../hooks/useBloqueoBiometrico');

const estado = (extra = {}) => ({
  bloqueado: true,
  autenticando: false,
  error: '',
  desbloquear: jest.fn(),
  ...extra,
});

describe('BloqueoBiometrico', () => {
  test('el overlay cubre la pantalla completa con posición absoluta', () => {
    jest.mocked(useBloqueoBiometrico).mockReturnValue(estado());

    render(<BloqueoBiometrico />);

    // La raíz del árbol es el overlay: no hay otro contenedor encima.
    const overlay = screen.toJSON();
    expect(StyleSheet.flatten(overlay.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    });
  });

  test('no dibuja nada mientras la app está desbloqueada', () => {
    jest.mocked(useBloqueoBiometrico).mockReturnValue(estado({ bloqueado: false }));

    render(<BloqueoBiometrico />);

    expect(screen.queryByText('Hallado está bloqueada')).toBeNull();
  });
});
