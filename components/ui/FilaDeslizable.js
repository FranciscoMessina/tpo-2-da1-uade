import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import Icono from './Icono';
import Texto from './Texto';
import { colores, espacio, tonos } from './tema';

// Desde qué distancia horizontal el gesto deja de ser un toque
const UMBRAL_GESTO = 10;
// Fracción del ancho a partir de la cual soltar elimina la fila
const FRACCION_ELIMINAR = 0.4;
// Un gesto rápido elimina aunque no haya llegado a la fracción anterior
const VELOCIDAD_ELIMINAR = 0.8;
const DISTANCIA_MINIMA_RAPIDO = 48;
const DURACION = 180;

/**
 * Fila que se elimina deslizándola hacia la izquierda. Al arrastrar se descubre un fondo rojo
 * con «Eliminar»; si se suelta pasada la fracción del ancho (o con un gesto rápido) la fila
 * sale de la pantalla y se llama a `onEliminar`, y si no vuelve a su lugar.
 *
 * El gesto no es la única vía: quien use un lector de pantalla debe poder eliminar con una
 * acción de accesibilidad en la fila interna (ver `FilaMenu`).
 */
export default function FilaDeslizable({ onEliminar, children }) {
  const [desplazamiento] = useState(() => new Animated.Value(0));
  const ancho = useRef(0);
  const alEliminar = useRef(onEliminar);

  useEffect(() => {
    alEliminar.current = onEliminar;
  }, [onEliminar]);

  // El responder tiene que ser siempre el mismo: si se recreara a mitad del gesto, perdería
  // su estado. Por eso los manejadores leen el ancho y el último callback desde refs, que solo
  // se consultan al arrastrar y soltar, nunca al renderizar.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    function volver() {
      Animated.spring(desplazamiento, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    }

    return PanResponder.create({
      // Solo toma el gesto si es horizontal hacia la izquierda: el scroll vertical y los
      // toques de la fila quedan intactos.
      onMoveShouldSetPanResponder: (_evento, { dx, dy }) =>
        dx < -UMBRAL_GESTO && Math.abs(dx) > Math.abs(dy) * 1.5,
      // Una vez que empezó el deslizamiento no se lo cede al scroll
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_evento, { dx }) => {
        desplazamiento.setValue(Math.min(0, dx));
      },
      onPanResponderRelease: (_evento, { dx, vx }) => {
        const pasoElUmbral = dx < -ancho.current * FRACCION_ELIMINAR;
        const gestoRapido = vx < -VELOCIDAD_ELIMINAR && dx < -DISTANCIA_MINIMA_RAPIDO;

        if (!pasoElUmbral && !gestoRapido) {
          volver();
          return;
        }

        Animated.timing(desplazamiento, {
          toValue: -Math.max(ancho.current, 1),
          duration: DURACION,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            alEliminar.current();
          }
        });
      },
      onPanResponderTerminate: volver,
    });
  });

  // El fondo aparece a medida que se arrastra
  const opacidadFondo = desplazamiento.interpolate({
    inputRange: [-UMBRAL_GESTO * 2, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.contenedor}
      onLayout={(evento) => {
        ancho.current = evento.nativeEvent.layout.width;
      }}
    >
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.fondo, { opacity: opacidadFondo }]}
      >
        <Icono nombre="delete-outline" tamano={22} color={tonos.peligro.texto} />
        <Texto variante="boton" tono="peligro">Eliminar</Texto>
      </Animated.View>

      <Animated.View
        style={[styles.fila, { transform: [{ translateX: desplazamiento }] }]}
        {...responder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { overflow: 'hidden' },
  fila: { backgroundColor: colores.superficie },
  fondo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tonos.peligro.fondo,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: espacio.xs,
    paddingRight: espacio.md,
  },
});
