import { createContext, useContext, useState } from 'react';
import { claveBusqueda } from '../data/searchDemo';

const SearchContext = createContext(null);

export function SearchProvider({ children }) {
  const [recientes, setRecientes] = useState([]);
  const [alertas, setAlertas] = useState([]);

  function recordarBusqueda(filtros) {
    const clave = claveBusqueda(filtros);

    setRecientes((actuales) =>
      [
        {
          clave,
          filtros: { ...filtros },
        },
        ...actuales.filter(
          (item) => item.clave !== clave
        ),
      ].slice(0, 5)
    );
  }

  function guardarAlerta(filtros) {
    const clave = claveBusqueda(filtros);

    setAlertas((actuales) => {
      const yaExiste = actuales.some(
        (item) => item.clave === clave
      );

      if (yaExiste) {
        return actuales;
      }

      return [
        ...actuales,
        {
          clave,
          filtros: { ...filtros },
        },
      ];
    });
  }

  return (
    <SearchContext.Provider
      value={{
        recientes,
        alertas,
        recordarBusqueda,
        guardarAlerta,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const contexto = useContext(SearchContext);

  if (!contexto) {
    throw new Error(
      'useSearch debe usarse dentro de SearchProvider.'
    );
  }

  return contexto;
}