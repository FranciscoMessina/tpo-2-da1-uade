import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PanResponder, Text } from 'react-native';
import { FilaDeslizable, FilaMenu } from '../../components/ui';

// PanResponder no se puede disparar con eventos de toque desde RNTL: se captura la
// configuración con la que se crea y se llaman sus manejadores como lo haría el sistema.
let gesto;
let crear;

beforeEach(() => {
  jest.useFakeTimers();
  const original = PanResponder.create.bind(PanResponder);
  crear = jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
    gesto = config;
    return original(config);
  });
});

afterEach(() => {
  crear.mockRestore();
  jest.useRealTimers();
});

function montar(onEliminar = jest.fn()) {
  render(
    <FilaDeslizable onEliminar={onEliminar}>
      <Text>Llaves en Palermo</Text>
    </FilaDeslizable>
  );
  // El ancho lo da el layout: sin esto el umbral sería 0
  fireEvent(screen.getByText('Llaves en Palermo').parent.parent.parent, 'layout', {
    nativeEvent: { layout: { width: 300, height: 60, x: 0, y: 0 } },
  });
  return onEliminar;
}

const deslizar = (dx, vx = 0) => {
  act(() => {
    gesto.onPanResponderMove({}, { dx, dy: 0 });
  });
  act(() => {
    gesto.onPanResponderRelease({}, { dx, dy: 0, vx });
  });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
};

describe('FilaDeslizable', () => {
  test('muestra el contenido y el fondo de eliminar', () => {
    montar();

    expect(screen.getByText('Llaves en Palermo')).toBeTruthy();
    expect(screen.getByText('Eliminar', { includeHiddenElements: true })).toBeTruthy();
  });

  test('elimina al deslizar a la izquierda más allá del umbral', () => {
    const onEliminar = montar();

    deslizar(-200);

    expect(onEliminar).toHaveBeenCalledTimes(1);
  });

  test('no elimina si se suelta antes del umbral', () => {
    const onEliminar = montar();

    deslizar(-60);

    expect(onEliminar).not.toHaveBeenCalled();
  });

  test('un gesto rápido elimina aunque sea corto', () => {
    const onEliminar = montar();

    deslizar(-80, -1.5);

    expect(onEliminar).toHaveBeenCalledTimes(1);
  });

  test('un roce rápido casi sin recorrido no elimina', () => {
    const onEliminar = montar();

    deslizar(-20, -2);

    expect(onEliminar).not.toHaveBeenCalled();
  });

  test('deslizar a la derecha no elimina', () => {
    const onEliminar = montar();

    deslizar(250);

    expect(onEliminar).not.toHaveBeenCalled();
  });

  test('si el sistema cancela el gesto la fila vuelve y no elimina', () => {
    const onEliminar = montar();

    act(() => {
      gesto.onPanResponderMove({}, { dx: -250, dy: 0 });
    });
    act(() => {
      gesto.onPanResponderTerminate({}, {});
      jest.advanceTimersByTime(1000);
    });

    expect(onEliminar).not.toHaveBeenCalled();
  });

  test('solo toma el gesto si es horizontal y hacia la izquierda', () => {
    montar();
    const toma = (dx, dy) => gesto.onMoveShouldSetPanResponder({}, { dx, dy });

    expect(toma(-30, 2)).toBe(true);
    expect(toma(-30, 40)).toBe(false); // scroll vertical
    expect(toma(-4, 0)).toBe(false); // todavía es un toque
    expect(toma(30, 0)).toBe(false); // hacia la derecha
  });

  test('usa siempre el último onEliminar', () => {
    const primero = jest.fn();
    const segundo = jest.fn();
    const { rerender } = render(
      <FilaDeslizable onEliminar={primero}>
        <Text>Fila</Text>
      </FilaDeslizable>
    );

    rerender(
      <FilaDeslizable onEliminar={segundo}>
        <Text>Fila</Text>
      </FilaDeslizable>
    );
    fireEvent(screen.getByText('Fila').parent.parent.parent, 'layout', {
      nativeEvent: { layout: { width: 300, height: 60, x: 0, y: 0 } },
    });
    deslizar(-250);

    expect(primero).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledTimes(1);
  });
});

describe('FilaMenu con acciones de accesibilidad', () => {
  test('expone la acción de eliminar al lector de pantalla', () => {
    const onAccessibilityAction = jest.fn();
    render(
      <FilaMenu
        titulo="Llaves"
        onPress={() => {}}
        accessibilityActions={[{ name: 'delete', label: 'Eliminar búsqueda' }]}
        onAccessibilityAction={onAccessibilityAction}
      />
    );

    const fila = screen.getByRole('button', { name: /Llaves/ });
    expect(fila.props.accessibilityActions).toEqual([
      { name: 'delete', label: 'Eliminar búsqueda' },
    ]);

    fireEvent(fila, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(onAccessibilityAction).toHaveBeenCalledTimes(1);
  });
});
