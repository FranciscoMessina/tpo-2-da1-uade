import { fireEvent, screen } from '@testing-library/react-native';

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
