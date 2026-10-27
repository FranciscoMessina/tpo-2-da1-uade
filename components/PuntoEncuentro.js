import { useState } from 'react';
import { Button, Linking, StyleSheet, Text, TextInput, View } from 'react-native';

export default function PuntoEncuentro({
  reclamoAceptado = false,
  encuentro = null,
  puedeProponer = false,
  puedeResponder = false,
  guardando = false,
  error = '',
  onProponer,
  onAceptar,
}) {
  const [direccion, setDireccion] = useState('');
  const [alternativa, setAlternativa] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');
  const [enviando, setEnviando] = useState(false);

  const ocupado = guardando || enviando;
  const pendiente = encuentro?.estado === 'pendiente';
  const aceptado = encuentro?.estado === 'aceptado';
  const responder = pendiente && puedeResponder;
  const mostrarFormulario = (!encuentro && puedeProponer) || (responder && alternativa);

  async function proponer() {
    const texto = direccion.trim();
    if (ocupado || !mostrarFormulario || typeof onProponer !== 'function') return;
    if (!texto) {
      setErrorLocal('Ingresá la dirección del punto de encuentro.');
      return;
    }
    setErrorLocal('');
    setEnviando(true);
    try {
      const guardado = await onProponer(texto);
      if (guardado === true) {
        setDireccion('');
        setAlternativa(false);
      }
    } catch {
      setErrorLocal('No se pudo enviar la propuesta. Intentá nuevamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function aceptar() {
    if (ocupado || !responder || typeof onAceptar !== 'function') return;
    setErrorLocal('');
    setEnviando(true);
    try {
      await onAceptar();
    } catch {
      setErrorLocal('No se pudo aceptar el encuentro. Intentá nuevamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function comoLlegar() {
    const destino = encuentro?.direccion?.trim();
    if (!destino) return;
    setErrorLocal('');
    try {
      await Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&dir_action=navigate`
      );
    } catch {
      setErrorLocal('No se pudo abrir Maps. Podés copiar la dirección e intentar nuevamente.');
    }
  }

  if (!reclamoAceptado) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Punto de encuentro</Text>
        <Text style={styles.help}>Primero debe aceptarse el reclamo para coordinar la devolución.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Punto de encuentro</Text>

      {encuentro ? (
        <>
          <Text style={styles.label}>
            {aceptado ? 'Encuentro acordado' : 'Propuesta de encuentro'}
          </Text>
          <Text selectable style={styles.address}>{encuentro.direccion}</Text>
          {pendiente && (
            <Text style={styles.help}>
              {puedeResponder
                ? 'Podés aceptar este lugar o sugerir otro.'
                : 'Esperando la respuesta de la otra persona.'}
            </Text>
          )}
          <Button title="Cómo llegar" onPress={comoLlegar} disabled={!encuentro.direccion?.trim()} />
        </>
      ) : (
        <Text style={styles.help}>
          {puedeProponer
            ? 'Proponé un lugar para devolver el objeto.'
            : 'La persona que tiene el objeto debe proponer un lugar.'}
        </Text>
      )}

      {responder && !alternativa && (
        <>
          <Button title={ocupado ? 'Guardando…' : 'Aceptar encuentro'}
            onPress={aceptar} disabled={ocupado || typeof onAceptar !== 'function'} />
          <Button title="Sugerir otro lugar" color="#6B7280"
            disabled={ocupado || typeof onProponer !== 'function'}
            onPress={() => { setErrorLocal(''); setAlternativa(true); }} />
        </>
      )}

      {mostrarFormulario && (
        <>
          <Text style={styles.label}>Dirección y localidad</Text>
          <TextInput
            accessibilityLabel="Dirección y localidad del punto de encuentro"
            style={styles.input}
            value={direccion}
            onChangeText={(texto) => { setDireccion(texto); setErrorLocal(''); }}
            placeholder="Ej.: Av. Santa Fe 1234, CABA"
            placeholderTextColor="#6B7280"
            maxLength={200}
            editable={!ocupado}
          />
          <Button title={ocupado ? 'Enviando…' : 'Enviar propuesta'}
            onPress={proponer} disabled={ocupado || typeof onProponer !== 'function'} />
          {alternativa && (
            <Button title="Cancelar" color="#6B7280" disabled={ocupado}
              onPress={() => { setAlternativa(false); setDireccion(''); setErrorLocal(''); }} />
          )}
        </>
      )}

      {!!(errorLocal || error) && (
        <Text accessibilityRole="alert" style={styles.error}>{errorLocal || error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  label: { fontSize: 15, fontWeight: '600', color: '#374151' },
  address: { fontSize: 16, color: '#111827' },
  help: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, color: '#111827' },
  error: { color: '#DC2626' },
});
