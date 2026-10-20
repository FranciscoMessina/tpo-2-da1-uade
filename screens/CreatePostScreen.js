import { useState } from 'react';
import {
  Button,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  CATEGORIAS,
  ZONAS,
  fechaLocal,
  fechaValida,
} from '../data/searchDemo';
import useCrearPublicacion from '../hooks/useCrearPublicacion';
import useUbicacionActual from '../hooks/useUbicacionActual';

const MAX_FOTOS = 5;

const FRANJAS = [
  { valor: 'manana', nombre: 'Mañana (6 a 12)' },
  { valor: 'tarde', nombre: 'Tarde (12 a 19)' },
  { valor: 'noche', nombre: 'Noche (19 a 6)' },
];

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

function ayer() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 1);
  return fechaLocal(fecha);
}

export default function CreatePostScreen({ route, navigation }) {
  const [tipo, setTipo] = useState(
    route.params?.tipo === 'encontre' ? 'encontre' : 'perdi'
  );
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [coords, setCoords] = useState(null);
  const [fecha, setFecha] = useState(fechaLocal());
  const [franja, setFranja] = useState('');
  const [fotos, setFotos] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorFotos, setErrorFotos] = useState('');
  const [publicada, setPublicada] = useState(null);

  const { publicar, enviando, error: errorEnvio } =
    useCrearPublicacion();
  const {
    obtener,
    cargando: ubicando,
    error: errorUbicacion,
  } = useUbicacionActual();

  function limpiarError(campo) {
    setErrores((actuales) => ({ ...actuales, [campo]: '' }));
  }

  function elegirBarrio(nombre) {
    setBarrio(nombre);
    setCoords(null);
    limpiarError('lugar');
  }

  async function usarUbicacion() {
    const resultado = await obtener();

    if (resultado) {
      setCoords(resultado);
      setBarrio('');
      limpiarError('lugar');
    }
  }

  async function agregarFotos() {
    setErrorFotos('');

    const disponibles = MAX_FOTOS - fotos.length;

    if (disponibles <= 0) {
      setErrorFotos(`Podés subir hasta ${MAX_FOTOS} fotos.`);
      return;
    }

    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: disponibles,
        quality: 0.7,
      });

      if (!resultado.canceled) {
        setFotos((actuales) =>
          [
            ...actuales,
            ...resultado.assets
              .map((asset) => asset.uri)
              .filter((uri) => !actuales.includes(uri)),
          ].slice(0, MAX_FOTOS)
        );
      }
    } catch (e) {
      setErrorFotos('No pudimos abrir la galería.');
    }
  }

  function quitarFoto(uri) {
    setFotos((actuales) => actuales.filter((f) => f !== uri));
  }

  function validar() {
    const nuevos = {};

    if (titulo.trim().length < 3) {
      nuevos.titulo = 'Escribí un título de al menos 3 caracteres.';
    }

    if (!categoria) {
      nuevos.categoria = 'Elegí una categoría.';
    }

    if (descripcion.trim().length < 10) {
      nuevos.descripcion =
        'Describí el objeto con al menos 10 caracteres.';
    }

    if (!barrio && !coords) {
      nuevos.lugar = 'Elegí un barrio o usá tu ubicación actual.';
    }

    if (!fechaValida(fecha)) {
      nuevos.fecha = 'Ingresá una fecha válida (AAAA-MM-DD).';
    } else if (fecha > fechaLocal()) {
      nuevos.fecha = 'La fecha no puede ser futura.';
    }

    if (!franja) {
      nuevos.franja = 'Elegí una franja horaria.';
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  async function enviar() {
    if (!validar()) {
      return;
    }

    const zona = ZONAS.find((z) => z.nombre === barrio);

    const resultado = await publicar({
      tipo,
      titulo: titulo.trim(),
      categoria,
      descripcion: descripcion.trim(),
      barrio,
      ubicacion: coords
        ? coords
        : zona
          ? { latitud: zona.latitud, longitud: zona.longitud }
          : null,
      fecha,
      franja,
      fotos,
    });

    if (resultado) {
      setPublicada(resultado);
    }
  }

  if (publicada) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.confirmIcon}>✅</Text>

          <Text style={styles.title}>
            {publicada.tipo === 'perdi'
              ? '¡Pérdida publicada!'
              : '¡Hallazgo publicado!'}
          </Text>

          <Text style={styles.help}>
            Tu publicación "{publicada.titulo}" ya está
            registrada. Te avisaremos si aparece una coincidencia.
            (Datos de ejemplo: todavía no se guarda en un servidor.)
          </Text>

          <Text style={styles.help}>
            {publicada.categoria} ·{' '}
            {publicada.barrio || 'Ubicación actual'} ·{' '}
            {publicada.fecha.split('-').reverse().join('/')} ·{' '}
            {FRANJAS.find((f) => f.valor === publicada.franja)?.nombre}
          </Text>

          <Text style={styles.help}>
            {publicada.fotos.length} foto(s) adjunta(s).
          </Text>
        </View>

        <Button
          title="Ver mi publicación"
          onPress={() =>
            navigation.replace('GestionPublicacion', {
              publicacionId: publicada.id,
            })
          }
        />

        <Button
          title="Volver al buscador"
          color="#6B7280"
          onPress={() => navigation.popToTop()}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={styles.title}>1. ¿Qué querés publicar?</Text>

        <Opciones
          opciones={[
            { valor: 'perdi', nombre: 'Perdí algo' },
            { valor: 'encontre', nombre: 'Encontré algo' },
          ]}
          valor={tipo}
          onChange={setTipo}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>2. ¿Qué es?</Text>

        <Text style={styles.label}>Título</Text>

        <TextInput
          accessibilityLabel="Título"
          style={styles.input}
          value={titulo}
          onChangeText={(valor) => {
            setTitulo(valor);
            limpiarError('titulo');
          }}
          placeholder="Por ejemplo: Llavero azul con 3 llaves"
          placeholderTextColor="#6B7280"
          maxLength={80}
        />
        {!!errores.titulo && (
          <Text style={styles.error}>{errores.titulo}</Text>
        )}

        <Text style={styles.label}>Categoría</Text>

        <Opciones
          opciones={CATEGORIAS.map((nombre) => ({
            valor: nombre,
            nombre,
          }))}
          valor={categoria}
          onChange={(valor) => {
            setCategoria(valor);
            limpiarError('categoria');
          }}
        />
        {!!errores.categoria && (
          <Text style={styles.error}>{errores.categoria}</Text>
        )}

        <Text style={styles.label}>Descripción</Text>

        <TextInput
          accessibilityLabel="Descripción"
          style={[styles.input, styles.multiline]}
          value={descripcion}
          onChangeText={(valor) => {
            setDescripcion(valor);
            limpiarError('descripcion');
          }}
          placeholder="Color, marca, señas particulares…"
          placeholderTextColor="#6B7280"
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        {!!errores.descripcion && (
          <Text style={styles.error}>{errores.descripcion}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>3. ¿Dónde?</Text>

        <Opciones
          opciones={ZONAS.map(({ nombre }) => ({
            valor: nombre,
            nombre,
          }))}
          valor={barrio}
          onChange={elegirBarrio}
        />

        <Button
          title={
            ubicando
              ? 'Obteniendo ubicación…'
              : 'Usar mi ubicación actual'
          }
          disabled={ubicando}
          onPress={usarUbicacion}
        />

        {!!errorUbicacion && !coords && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorUbicacion}
          </Text>
        )}

        {coords && (
          <Text style={styles.help}>
            Ubicación actual: {coords.latitud.toFixed(4)},{' '}
            {coords.longitud.toFixed(4)}
          </Text>
        )}

        {!!errores.lugar && (
          <Text style={styles.error}>{errores.lugar}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>4. ¿Cuándo?</Text>

        <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>

        <TextInput
          accessibilityLabel="Fecha del suceso"
          style={styles.input}
          value={fecha}
          onChangeText={(valor) => {
            setFecha(valor);
            limpiarError('fecha');
          }}
          placeholder={fechaLocal()}
          placeholderTextColor="#6B7280"
          maxLength={10}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        <Opciones
          opciones={[
            { valor: fechaLocal(), nombre: 'Hoy' },
            { valor: ayer(), nombre: 'Ayer' },
          ]}
          valor={fecha}
          onChange={(valor) => {
            setFecha(valor);
            limpiarError('fecha');
          }}
        />
        {!!errores.fecha && (
          <Text style={styles.error}>{errores.fecha}</Text>
        )}

        <Text style={styles.label}>Franja horaria</Text>

        <Opciones
          opciones={FRANJAS}
          valor={franja}
          onChange={(valor) => {
            setFranja(valor);
            limpiarError('franja');
          }}
        />
        {!!errores.franja && (
          <Text style={styles.error}>{errores.franja}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>5. Fotos (opcional)</Text>

        <Text style={styles.help}>
          Hasta {MAX_FOTOS} fotos. {fotos.length} elegida(s).
        </Text>

        {fotos.length > 0 && (
          <View style={styles.photos}>
            {fotos.map((uri) => (
              <View key={uri} style={styles.photoBox}>
                <Image
                  source={{ uri }}
                  style={styles.photo}
                  accessibilityLabel="Foto elegida"
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  onPress={() => quitarFoto(uri)}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Button
          title="Agregar fotos"
          disabled={fotos.length >= MAX_FOTOS}
          onPress={agregarFotos}
        />

        {!!errorFotos && (
          <Text style={styles.error}>{errorFotos}</Text>
        )}
      </View>

      {Object.values(errores).some(Boolean) && (
        <Text accessibilityRole="alert" style={styles.error}>
          Revisá los campos marcados antes de publicar.
        </Text>
      )}

      {!!errorEnvio && (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorEnvio}
        </Text>
      )}

      <Button
        title={
          enviando
            ? 'Publicando…'
            : tipo === 'perdi'
              ? 'Publicar mi pérdida'
              : 'Publicar mi hallazgo'
        }
        disabled={enviando}
        onPress={enviar}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
    backgroundColor: '#F3F4F6',
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
  multiline: {
    minHeight: 100,
  },
  error: {
    color: '#DC2626',
    fontSize: 15,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoBox: {
    width: 90,
    height: 90,
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmIcon: {
    fontSize: 48,
  },
});
