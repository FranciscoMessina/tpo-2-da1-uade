import { useState } from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import SelectorFecha, { aDate, deDate, textoDeValor } from '../../components/SelectorFecha';

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(DateTimePickerAndroid.open).mockClear();
});

const opcionesAbiertas = (indice = 0) => jest.mocked(DateTimePickerAndroid.open).mock.calls[indice][0];

describe('conversión de valores', () => {
  test('la fecha se muestra DD/MM/AAAA y la hora HH:MM', () => {
    expect(textoDeValor('2026-11-03', 'date')).toBe('03/11/2026');
    expect(textoDeValor('09:05', 'time')).toBe('09:05');
  });

  test('valores inválidos no se muestran', () => {
    for (const valor of ['', undefined, '2026-13-01', '2026-02-30', '03/11/2026']) {
      expect(textoDeValor(valor, 'date')).toBe('');
    }
    for (const valor of ['24:00', '12:60', '9:5', null]) {
      expect(textoDeValor(valor, 'time')).toBe('');
    }
  });

  test('ida y vuelta conserva el formato de los datos', () => {
    expect(deDate(aDate('2026-01-09', 'date'), 'date')).toBe('2026-01-09');
    expect(deDate(aDate('07:30', 'time'), 'time')).toBe('07:30');
    expect(deDate(new Date(2026, 10, 3, 18, 4), 'time')).toBe('18:04');
  });
});

describe('SelectorFecha en Android', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'android'));

  test('muestra la fecha y abre el diálogo nativo con el valor actual', () => {
    render(<SelectorFecha etiqueta="Fecha" valor="2026-11-03" onChange={jest.fn()} />);

    expect(screen.getByText('03/11/2026')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Fecha'));

    expect(opcionesAbiertas().mode).toBe('date');
    expect(deDate(opcionesAbiertas().value, 'date')).toBe('2026-11-03');
  });

  test('al confirmar devuelve AAAA-MM-DD', () => {
    const onChange = jest.fn();
    render(<SelectorFecha etiqueta="Fecha" valor="" onChange={onChange} />);
    expect(screen.getByText('Elegir fecha')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Fecha'));
    opcionesAbiertas().onValueChange({}, new Date(2026, 4, 7));

    expect(onChange).toHaveBeenCalledWith('2026-05-07');
  });

  test('pasa los límites al diálogo, y el máximo incluye todo el día', () => {
    render(
      <SelectorFecha etiqueta="Fecha" valor="" onChange={jest.fn()} minimo="2026-11-01" maximo="2026-11-10" />
    );

    fireEvent.press(screen.getByLabelText('Fecha'));

    const { minimumDate, maximumDate } = opcionesAbiertas();
    expect(deDate(minimumDate, 'date')).toBe('2026-11-01');
    expect(deDate(maximumDate, 'date')).toBe('2026-11-10');
    expect(maximumDate.getHours()).toBe(23);
  });

  test('sin valor abre dentro de los límites y no los supera al confirmar', () => {
    const onChange = jest.fn();
    render(<SelectorFecha etiqueta="Fecha" valor="" onChange={onChange} maximo="2020-01-01" />);

    fireEvent.press(screen.getByLabelText('Fecha'));
    expect(deDate(opcionesAbiertas().value, 'date')).toBe('2020-01-01');

    opcionesAbiertas().onValueChange({}, new Date(2026, 0, 1));
    expect(onChange).toHaveBeenCalledWith('2020-01-01');
  });

  test('en modo hora abre el selector de hora en 24 h y devuelve HH:MM', () => {
    const onChange = jest.fn();
    render(<SelectorFecha modo="time" etiqueta="Hora" valor="08:15" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Hora'));
    expect(opcionesAbiertas()).toMatchObject({ mode: 'time', is24Hour: true });
    expect(deDate(opcionesAbiertas().value, 'time')).toBe('08:15');

    opcionesAbiertas().onValueChange({}, new Date(2026, 0, 1, 21, 5));
    expect(onChange).toHaveBeenCalledWith('21:05');
  });

  test('la hora respeta el mínimo y el máximo', () => {
    const onChange = jest.fn();
    render(
      <SelectorFecha modo="time" etiqueta="Hora" valor="" onChange={onChange} minimo="09:00" maximo="18:00" />
    );

    fireEvent.press(screen.getByLabelText('Hora'));
    opcionesAbiertas().onValueChange({}, new Date(2026, 0, 1, 7, 0));

    expect(onChange).toHaveBeenCalledWith('09:00');
  });

  test('permitirVaciar suma «Borrar» solo si hay valor, y vacía', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <SelectorFecha etiqueta="Fecha" valor="" onChange={onChange} permitirVaciar />
    );

    fireEvent.press(screen.getByLabelText('Fecha'));
    expect(opcionesAbiertas(0).neutralButton).toBeUndefined();

    rerender(<SelectorFecha etiqueta="Fecha" valor="2026-11-03" onChange={onChange} permitirVaciar />);
    fireEvent.press(screen.getByLabelText('Fecha'));
    expect(opcionesAbiertas(1).neutralButton).toEqual({ label: 'Borrar' });

    opcionesAbiertas(1).onNeutralButtonPress();
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('cancelar el diálogo no cambia nada y deshabilitado no lo abre', () => {
    const onChange = jest.fn();
    const { rerender } = render(<SelectorFecha etiqueta="Fecha" valor="2026-11-03" onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('Fecha'));
    expect(onChange).not.toHaveBeenCalled();

    rerender(<SelectorFecha etiqueta="Fecha" valor="" onChange={onChange} disabled />);
    fireEvent.press(screen.getByLabelText('Fecha'));
    expect(DateTimePickerAndroid.open).toHaveBeenCalledTimes(1);
  });

  test('muestra el error y el estado accesible', () => {
    render(<SelectorFecha etiqueta="Fecha" valor="2026-11-03" error="Fecha futura" onChange={jest.fn()} />);

    expect(screen.getByText('Fecha futura')).toBeTruthy();
    expect(screen.getByLabelText('Fecha')).toHaveAccessibilityValue({ text: '03/11/2026' });
  });
});

describe('SelectorFecha en iOS', () => {
  function Controlado({ valor: inicial = '', onChange, ...props }) {
    const [valor, setValor] = useState(inicial);

    return (
      <SelectorFecha
        etiqueta="Fecha"
        {...props}
        valor={valor}
        onChange={(nuevo) => {
          setValor(nuevo);
          onChange?.(nuevo);
        }}
      />
    );
  }

  test('abre una hoja, confirma con «Listo» y devuelve AAAA-MM-DD', () => {
    const onChange = jest.fn();
    render(<Controlado onChange={onChange} />);
    expect(screen.queryByTestId('datetimepicker')).toBeNull();

    fireEvent.press(screen.getByLabelText('Fecha'));
    act(() => screen.getByTestId('datetimepicker').props.onValueChange({}, new Date(2026, 5, 20)));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Listo'));

    expect(onChange).toHaveBeenCalledWith('2026-06-20');
    expect(screen.getByText('20/06/2026')).toBeTruthy();
    expect(screen.queryByTestId('datetimepicker')).toBeNull();
  });

  test('«Cancelar» cierra sin cambiar y «Borrar» vacía', () => {
    const onChange = jest.fn();
    render(<Controlado valor="2026-11-03" permitirVaciar onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Fecha'));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Fecha'));
    fireEvent.press(screen.getByText('Borrar'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByText('Elegir fecha')).toBeTruthy();
  });

  test('le pasa al selector el modo y los límites', () => {
    render(<Controlado minimo="2026-11-01" maximo="2026-11-10" />);

    fireEvent.press(screen.getByLabelText('Fecha'));
    const props = screen.getByTestId('datetimepicker').props;

    expect(props.mode).toBe('date');
    expect(deDate(props.minimumDate, 'date')).toBe('2026-11-01');
    expect(deDate(props.maximumDate, 'date')).toBe('2026-11-10');
  });
});
