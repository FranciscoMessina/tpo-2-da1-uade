import { act, fireEvent, screen } from '@testing-library/react-native';

// Abre el desplegable de barrios (SelectorBarrio) por su etiqueta accesible.
export function abrirSelectorBarrio(etiqueta = 'Barrio') {
  fireEvent.press(screen.getByLabelText(etiqueta));
}

// Abre el desplegable de barrios y elige uno de la lista. La lista dibuja unas filas por vez, así
// que se busca el barrio como lo haría una persona.
export function elegirBarrio(nombre, etiqueta = 'Barrio') {
  abrirSelectorBarrio(etiqueta);
  if (nombre !== 'Sin barrio') {
    fireEvent.changeText(screen.getByLabelText('Buscar barrio'), nombre);
  }
  fireEvent.press(screen.getByLabelText(nombre));
}

// Abre el selector de hora (SelectorFecha en modo «time») y confirma `valor` (HH:MM). En iOS, que es
// la plataforma de las pruebas, el selector es una hoja con «Listo».
export function elegirHora(valor, etiqueta = 'Hora del suceso') {
  const [horas, minutos] = valor.split(':').map(Number);

  fireEvent.press(screen.getByLabelText(etiqueta));
  act(() => {
    screen.getByTestId('datetimepicker').props.onValueChange({}, new Date(2026, 0, 1, horas, minutos));
  });
  fireEvent.press(screen.getByText('Listo'));
}
