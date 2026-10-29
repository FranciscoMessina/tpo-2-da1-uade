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

const ConexionContext = createContext({
  hayConexion: true,
  comprobarConexion: async () => true,
});

export function ConexionProvider({ children }) {
  const [hayConexion, setHayConexion] = useState(estaConectado);

  useEffect(() => {
    // Refleja el estado compartido del módulo y sondea solo con la app en primer plano
    setHayConexion(estaConectado());
    const desuscribir = suscribirConexion(setHayConexion);
    const detenerSondeo = iniciarSondeo();
    return () => {
      desuscribir();
      detenerSondeo();
    };
  }, []);

  const value = useMemo(
    () => ({ hayConexion, comprobarConexion: verificarConexion }),
    [hayConexion]
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
    return { hayConexion: true, comprobarConexion: async () => true };
  }
  return contexto;
}
