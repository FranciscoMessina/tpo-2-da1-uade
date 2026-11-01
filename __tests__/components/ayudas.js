import { fireEvent, screen } from '@testing-library/react-native';

// Abre el desplegable de barrios (SelectorBarrio) por su etiqueta accesible.
export function abrirSelectorBarrio(etiqueta = 'Barrio') {
  fireEvent.press(screen.getByLabelText(etiqueta));
}

// Abre el desplegable de barrios y elige uno de la lista.
export function elegirBarrio(nombre, etiqueta = 'Barrio') {
  abrirSelectorBarrio(etiqueta);
  fireEvent.press(screen.getByLabelText(nombre));
}
