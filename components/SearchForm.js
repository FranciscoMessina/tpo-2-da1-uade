import { useState } from 'react';
import {
  Button,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CATEGORIAS,
  PERIODOS,
  ZONAS,
  validarFiltros,
} from '../data/searchDemo';

function Opciones({ opciones, valor, onChange }) {
  return (
    <View style={styles.options}>
      {opciones.map((opcion) => (
        <Pressable
          key={opcion.valor}
          accessibilityRole="button"
          accessibilityState={{
            selected: valor === opcion.valor,
          }}
          onPress={() => onChange(opcion.valor)}
          style={({ pressed }) => [
            styles.option,
            valor === opcion.valor && styles.selected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.optionText,
              valor === opcion.valor && styles.selectedText,
            ]}
          >
            {opcion.nombre}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SearchForm({
  initialFilters,
  onSubmit,
  submitLabel = 'Buscar coincidencias',
}) {
  const [filtros, setFiltros] = useState(() => ({
    ...initialFilters,
  }));
  const [error, setError] = useState('');

  function cambiar(campo, valor) {
    setError('');

    setFiltros((actuales) => ({
      ...actuales,
      [campo]: valor,
    }));
  }

  function elegirZona(zona) {
    setError('');

    setFiltros((actuales) => ({
      ...actuales,
      zona,
      ubicacion: null,
    }));
  }

  function usarUbicacionEjemplo() {
    setError('');

    setFiltros((actuales) => ({
      ...actuales,
      zona: '',
      ubicacion: {
        latitud: -34.6037,
        longitud: -58.3816,
      },
    }));
  }

  function buscar() {
    const mensaje = validarFiltros(filtros);

    if (mensaje) {
      setError(mensaje);
      return;
    }

    onSubmit({
      ...filtros,
      palabras: filtros.palabras.trim(),
    });
  }

  return (
    <View style={styles.form}>
      <View style={styles.section}>
        <Text style={styles.title}>1. ¿Qué te pasó?</Text>

        <Opciones
          opciones={[
            { valor: 'perdi', nombre: 'Perdí algo' },
            { valor: 'encontre', nombre: 'Encontré algo' },
          ]}
          valor={filtros.situacion}
          onChange={(valor) => cambiar('situacion', valor)}
        />

        <Text style={styles.help}>
          {filtros.situacion === 'perdi'
            ? 'Vas a ver lo que otras personas encontraron.'
            : 'Vas a ver lo que otras personas perdieron.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>2. ¿Qué es?</Text>

        <Opciones
          opciones={CATEGORIAS.map((nombre) => ({
            valor: nombre,
            nombre,
          }))}
          valor={filtros.categoria}
          onChange={(valor) => cambiar('categoria', valor)}
        />

        <Text style={styles.label}>
          Palabras clave (opcional)
        </Text>

        <TextInput
          accessibilityLabel="Palabras clave"
          style={styles.input}
          value={filtros.palabras}
          onChangeText={(valor) => cambiar('palabras', valor)}
          placeholder="Por ejemplo: llavero azul"
          placeholderTextColor="#6B7280"
          maxLength={100}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>3. ¿Dónde?</Text>

        <Text style={styles.help}>
          Elegí un barrio o una localidad.
        </Text>

        <Opciones
          opciones={ZONAS.map(({ nombre }) => ({
            valor: nombre,
            nombre,
          }))}
          valor={filtros.zona}
          onChange={elegirZona}
        />

        <Button
          title="Probar ubicación de ejemplo"
          onPress={usarUbicacionEjemplo}
        />

        {filtros.ubicacion && (
          <Text style={styles.help}>
            Ubicación de ejemplo: Centro. Se buscará en todos
            los barrios.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>4. ¿Cuándo?</Text>

        <Opciones
          opciones={PERIODOS}
          valor={filtros.periodo}
          onChange={(valor) => cambiar('periodo', valor)}
        />

        {filtros.periodo === 'rango' && (
          <View style={styles.dates}>
            <View style={styles.dateField}>
              <Text style={styles.label}>
                Desde (AAAA-MM-DD)
              </Text>

              <TextInput
                accessibilityLabel="Fecha desde"
                style={styles.input}
                value={filtros.desde}
                onChangeText={(valor) => cambiar('desde', valor)}
                placeholder="2026-10-01"
                placeholderTextColor="#6B7280"
                maxLength={10}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.dateField}>
              <Text style={styles.label}>
                Hasta (AAAA-MM-DD)
              </Text>

              <TextInput
                accessibilityLabel="Fecha hasta"
                style={styles.input}
                value={filtros.hasta}
                onChangeText={(valor) => cambiar('hasta', valor)}
                placeholder="2026-10-13"
                placeholderTextColor="#6B7280"
                maxLength={10}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        )}
      </View>

      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      <Button title={submitLabel} onPress={buscar} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#1D4ED8',
  },
  pressed: {
    opacity: 0.7,
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
  },
  selectedText: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  help: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 48,
  },
  dates: {
    gap: 12,
  },
  dateField: {
    gap: 4,
  },
  error: {
    color: '#DC2626',
    fontSize: 15,
  },
});