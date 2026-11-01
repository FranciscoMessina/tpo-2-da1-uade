import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  estaConectado,
  iniciarSondeo,
  suscribirConexion,
  verificarConexion,
} from '../services/conexion';
import { hayInternet, suscribirRed } from '../services/red';

const ConexionContext = createContext({
  hayConexion: true,
  sinInternet: false,
  comprobarConexion: async () => true,
});

export function ConexionProvider({ children }) {
  const [hayConexion, setHayConexion] = useState(estaConectado);
  // El dispositivo no tiene red (modo avión, sin señal); si es false pero no hay conexión,
  // la red está y el que no responde es el servidor.
  const [sinInternet, setSinInternet] = useState(() => !hayInternet());

  useEffect(() => {
    // Refleja el estado compartido del módulo y sondea solo con la app en primer plano
    setHayConexion(estaConectado());
    setSinInternet(!hayInternet());
    const desuscribir = suscribirConexion(setHayConexion);
    const desuscribirRed = suscribirRed((hayRed) => setSinInternet(!hayRed));
    const detenerSondeo = iniciarSondeo();
    return () => {
      desuscribir();
      desuscribirRed();
      detenerSondeo();
    };
  }, []);

  const value = useMemo(
    () => ({ hayConexion, sinInternet, comprobarConexion: verificarConexion }),
    [hayConexion, sinInternet]
  );

  return (
    <ConexionContext.Provider value={value}>
      {children}
    </ConexionContext.Provider>
  );
}

export function useConexion() {
  const contexto = useContext(ConexionContext);
  if (!contexto) {
    return { hayConexion: true, sinInternet: false, comprobarConexion: async () => true };
  }
  return contexto;
}
