import { colores, tipografia } from './tema';

// Pantalla que contiene la barra inferior dentro del stack principal
export const RUTA_PESTANAS = 'Principal';

// Encabezado común del stack y de las pestañas
export const opcionesEncabezado = {
  headerStyle: { backgroundColor: colores.superficie },
  headerTintColor: colores.texto,
  headerTitleStyle: { fontSize: tipografia.seccion.fontSize, fontWeight: tipografia.seccion.fontWeight },
  headerShadowVisible: false,
};

// Desde una pantalla apilada vuelve a una pestaña de la barra inferior (con parámetros opcionales)
export function irAPestana(navigation, pestana, params = undefined) {
  navigation.popTo(RUTA_PESTANAS, params ? { screen: pestana, params } : { screen: pestana });
}
