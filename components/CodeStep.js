import { useEffect, useState } from 'react';
import { SEGUNDOS_REENVIO } from '../hooks/useAuth';
import { Boton, Campo, Texto } from './ui';

// Paso de código OTP con reenvío y cuenta regresiva (compartido por
// Registro y Recuperar contraseña).
export default function CodeStep({
  email,
  loading,
  onVerify,
  onResend,
  onChangeEmail,
}) {
  const [codigo, setCodigo] = useState('');
  const [errorLocal, setErrorLocal] = useState('');
  const [segundos, setSegundos] = useState(SEGUNDOS_REENVIO);

  useEffect(() => {
    if (segundos <= 0) return undefined;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  function verificar() {
    if (!/^\d{6}$/.test(codigo)) {
      setErrorLocal('El código debe tener 6 dígitos.');
      return;
    }
    setErrorLocal('');
    onVerify(codigo);
  }

  async function reenviar() {
    setCodigo('');
    setErrorLocal('');
    if (await onResend()) setSegundos(SEGUNDOS_REENVIO);
  }

  return (
    <>
      <Texto variante="cuerpoChico" tono="secundario">
        Te enviamos un código de 6 dígitos a {email}. (Prueba: 123456; con
        000000 se simula un código expirado.)
      </Texto>
      <Campo
        etiqueta="Código de verificación"
        value={codigo}
        onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
        error={errorLocal}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        autoComplete="one-time-code"
      />
      <Boton titulo="Verificar código" onPress={verificar} cargando={loading} />
      <Boton
        titulo={segundos > 0 ? `Reenviar código en ${segundos}s` : 'Reenviar código'}
        variante="terciario"
        chico
        disabled={segundos > 0 || loading}
        onPress={reenviar}
      />
      <Boton titulo="Cambiar email" variante="terciario" chico onPress={onChangeEmail} />
    </>
  );
}
