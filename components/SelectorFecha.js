import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Boton, CampoSeleccion, Texto, colores, espacio, radios } from './ui';

// Selector nativo de fecha (`date`, valor AAAA-MM-DD) o de hora (`time`, valor HH:MM). El valor que
// entra y sale conserva el formato de los datos; en pantalla la fecha se ve como DD/MM/AAAA.
//
// Android abre el diálogo del sistema con la API imperativa del paquete (la que recomienda su
// documentación). iOS dibuja el selector en una hoja propia con «Listo» y «Cancelar». El diálogo
// vive dentro de la misma actividad: no pasa la app a segundo plano, así que no dispara el
// bloqueo biométrico y no hace falta `conActividadExterna`.

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^(\d{2}):(\d{2})$/;

/** Convierte AAAA-MM-DD o HH:MM en un Date local, o `null` si el texto no es válido. */
export function aDate(valor, modo) {
  if (typeof valor !== 'string') return null;

  if (modo === 'time') {
    const partes = HORA.exec(valor);

    if (!partes || Number(partes[1]) > 23 || Number(partes[2]) > 59) return null;

    const fecha = new Date();
    fecha.setHours(Number(partes[1]), Number(partes[2]), 0, 0);
    return fecha;
  }

  const partes = FECHA.exec(valor);

  if (!partes) return null;

  const [, anio, mes, dia] = partes.map(Number);
  const fecha = new Date(anio, mes - 1, dia);

  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
    ? fecha
    : null;
}

const dos = (n) => String(n).padStart(2, '0');

/** Convierte un Date local en AAAA-MM-DD o HH:MM. */
export function deDate(fecha, modo) {
  return modo === 'time'
    ? `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
    : `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Texto que se muestra: DD/MM/AAAA para fechas, HH:MM para horas, '' si el valor no es válido. */
export function textoDeValor(valor, modo) {
  const fecha = aDate(valor, modo);

  if (!fecha) return '';

  return modo === 'time'
    ? deDate(fecha, 'time')
    : `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

// Deja `valor` dentro de [minimo, maximo]. Los textos AAAA-MM-DD y HH:MM ordenan como los datos.
function acotar(valor, minimo, maximo) {
  if (minimo && valor < minimo) return minimo;
  if (maximo && valor > maximo) return maximo;
  return valor;
}

export default function SelectorFecha({
  modo = 'date',
  etiqueta = undefined,
  valor = '',
  onChange,
  error = undefined,
  minimo = undefined,
  maximo = undefined,
  accessibilityLabel = undefined,
  permitirVaciar = false,
  placeholder = undefined,
  disabled = false,
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(new Date());
  const esHora = modo === 'time';
  const texto = textoDeValor(valor, modo);
  const limiteMinimo = aDate(minimo, modo);
  const limiteMaximo = aDate(maximo, modo);
  // El último día permitido incluye todo el día.
  const finMaximo =
    limiteMaximo && !esHora
      ? new Date(limiteMaximo.getFullYear(), limiteMaximo.getMonth(), limiteMaximo.getDate(), 23, 59, 59)
      : null;
  const puedeVaciar = permitirVaciar && texto !== '';

  // Fecha con la que abre el selector: el valor actual, si no hoy/ahora, siempre dentro de los límites.
  function inicial() {
    const base = aDate(valor, modo) ?? new Date();

    return aDate(acotar(deDate(base, modo), minimo, maximo), modo) ?? base;
  }

  function confirmar(fecha) {
    onChange(acotar(deDate(fecha, modo), minimo, maximo));
  }

  function abrir() {
    const fecha = inicial();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fecha,
        mode: /** @type {'date' | 'time'} */ (modo),
        is24Hour: true,
        ...(!esHora && limiteMinimo && { minimumDate: limiteMinimo }),
        ...(finMaximo && { maximumDate: finMaximo }),
        ...(puedeVaciar && { neutralButton: { label: 'Borrar' } }),
        onValueChange: (_evento, elegida) => confirmar(elegida),
        onNeutralButtonPress: () => onChange(''),
      });
      return;
    }

    setBorrador(fecha);
    setAbierto(true);
  }

  return (
    <View>
      <CampoSeleccion
        etiqueta={etiqueta}
        valor={texto}
        placeholder={placeholder ?? (esHora ? 'Elegir hora' : 'Elegir fecha')}
        icono={esHora ? 'clock-outline' : 'calendar-month-outline'}
        error={error}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        onPress={abrir}
      />

      {Platform.OS !== 'android' && (
        <Modal
          visible={abierto}
          transparent
          animationType="fade"
          onRequestClose={() => setAbierto(false)}
        >
          <View style={styles.fondo}>
            <View style={styles.hoja}>
              <Texto variante="seccion">{etiqueta ?? (esHora ? 'Hora' : 'Fecha')}</Texto>

              <DateTimePicker
                value={borrador}
                mode={/** @type {'date' | 'time'} */ (modo)}
                display="spinner"
                locale="es-AR"
                is24Hour
                {...(!esHora && limiteMinimo && { minimumDate: limiteMinimo })}
                {...(finMaximo && { maximumDate: finMaximo })}
                onValueChange={(_evento, elegida) => setBorrador(elegida)}
              />

              <Boton
                titulo="Listo"
                onPress={() => {
                  setAbierto(false);
                  confirmar(borrador);
                }}
              />
              {puedeVaciar && (
                <Boton
                  titulo="Borrar"
                  variante="secundario"
                  onPress={() => {
                    setAbierto(false);
                    onChange('');
                  }}
                />
              )}
              <Boton titulo="Cancelar" variante="terciario" onPress={() => setAbierto(false)} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: colores.velo },
  hoja: {
    gap: espacio.sm,
    padding: espacio.md,
    paddingBottom: espacio.lg,
    borderTopLeftRadius: radios.tarjeta,
    borderTopRightRadius: radios.tarjeta,
    backgroundColor: colores.superficie,
  },
});
