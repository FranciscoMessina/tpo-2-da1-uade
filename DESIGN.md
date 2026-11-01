# Sistema de diseño de Hallado

Hallado ayuda a recuperar objetos perdidos: la interfaz tiene que transmitir calma y confianza en un momento de estrés. Es un producto de uso puntual, con mucho texto y datos sensibles, así que la claridad va antes que la decoración.

Los tokens viven en `components/ui/tema.js`, los componentes en `components/ui/` y se importan desde `components/ui`. Las pantallas no escriben colores, tamaños de letra ni controles propios.

## Tokens

### Color

La app es solo clara (`userInterfaceStyle: light`). El azul es la identidad y marca la acción y la selección.

| Token | Valor | Uso |
| --- | --- | --- |
| `colores.fondo` | `#F3F4F6` | Fondo de pantalla |
| `colores.superficie` | `#FFFFFF` | Tarjetas, encabezados, barra inferior |
| `colores.superficieHundida` | `#F3F4F6` | `Panel` dentro de una tarjeta |
| `colores.borde` | `#E5E7EB` | Separadores |
| `colores.bordeControl` | `#8A92A0` | Contorno de campos y chips (3:1 sobre blanco) |
| `colores.texto` | `#111827` | Texto principal |
| `colores.textoSecundario` | `#4B5563` | Ayudas y datos (4,5:1 también sobre el fondo gris) |
| `colores.textoTenue` | `#6B7280` | Solo sobre blanco: placeholders y deshabilitados |
| `colores.primario` | `#1D4ED8` | Acción principal y selección |
| `colores.primarioSuave` | `#DBEAFE` | Fondo de acciones secundarias y selección |

Cada significado es un par `tonos.*` de fondo y texto que supera 4,5:1. Se usan siempre juntos:

| Tono | Fondo | Texto | Significado |
| --- | --- | --- | --- |
| `neutro` | `#E5E7EB` | `#374151` | Estados cerrados o sin carga |
| `info` | `#DBEAFE` | `#1E40AF` | Información y tipo «Encontrado» |
| `exito` | `#DCFCE7` | `#166534` | Confirmaciones y estados abiertos |
| `aviso` | `#FEF3C7` | `#92400E` | Pendientes, vencimientos y sin conexión |
| `peligro` | `#FEE2E2` | `#991B1B` | Errores y acciones destructivas |

### Tipografía

Se usa la letra del sistema y se respeta el tamaño elegido en el dispositivo: los textos nunca bloquean el escalado.

| Rol (`variante`) | Tamaño / línea | Peso | Uso |
| --- | --- | --- | --- |
| `pantalla` | 24 / 30 | 700 | Título del contenido |
| `seccion` | 18 / 24 | 700 | Título de tarjeta y encabezado |
| `subtitulo` | 16 / 22 | 600 | Título de un elemento de lista |
| `cuerpo` | 16 / 24 | 400 | Texto y valores |
| `cuerpoChico` | 14 / 20 | 400 | Ayudas, datos secundarios y errores |
| `etiqueta` | 14 / 20 | 600 | Etiquetas de campo |
| `boton` | 15 / 20 | 600 | Botones |
| `leyenda` | 12 / 16 | 400 | Notas mínimas |
| `leyendaFuerte` | 12 / 16 | 600 | Insignias, etiquetas de dato y pestañas |

### Espacio y forma

- Espacios (`espacio`): `xxs` 4, `xs` 8, `sm` 12, `md` 16, `lg` 24, `xl` 32.
- Radios (`radios`): `chico` 8, `control` 12, `tarjeta` 16, `pastilla` para insignias y avatares.
- Controles: 48 dp de alto y al menos 44 dp de área táctil, aunque se dibujen más chicos.
- Sin sombras: la jerarquía sale del contraste entre fondo gris y superficie blanca.

## Componentes

| Componente | Uso |
| --- | --- |
| `Pantalla` | Marco con scroll y teclado de las pantallas de contenido |
| `Texto` | Todo texto, con `variante` y `tono` |
| `Boton` | Acciones: `primario`, `secundario`, `terciario`, `peligro` |
| `Tocable` | Base táctil: onda en Android, atenuado en iOS |
| `Icono` | Material Design Icons, por nombre |
| `Tarjeta`, `Seccion`, `Panel`, `Separador`, `Fila` | Estructura de contenido |
| `Campo` | Texto con etiqueta, ayuda y error |
| `CampoSeleccion` | Campo que abre un selector al tocarlo (base de `SelectorBarrio` y `SelectorFecha`, en `components/`) |
| `SelectorBarrio` (en `components/`) | Barrio: lista con buscador sobre el catálogo; el único selector de barrio de la app |
| `SelectorFecha` (en `components/`) | Fecha (`AAAA-MM-DD`) u hora (`HH:MM`) con el selector nativo; se ve como `DD/MM/AAAA` |
| `Chip`, `GrupoOpciones` | Selección entre opciones visibles |
| `Pestanas` | Vistas hermanas dentro de una pantalla |
| `Insignia`, `InsigniaTipo`, `InsigniaEstado` | Tipo y estado de una publicación o reclamo |
| `Aviso`, `AvisoSinConexion`, `NotaSinConexion` | Mensajes de estado dentro del contenido |
| `EstadoVacio`, `ErrorConReintento`, `Cargando` | Estados de una lista o pantalla |
| `FilaDato`, `FilaMenu`, `FilaInterruptor` | Filas de detalle, menú y ajustes |
| `Avatar`, `Paginacion`, `IndicadorPasos`, `ModalPantalla` | Patrones puntuales |
| `TarjetaPublicacion` (en `components/`) | Publicación en cualquier lista |

## Reglas

- **Una acción principal por vista.** Las demás son `secundario` o `terciario`; lo que borra, rechaza o cierra es `peligro`.
- **Sin tarjetas anidadas.** Dentro de una tarjeta se agrupa con `Panel` o `Separador`.
- **El estado no depende solo del color.** Toda insignia lleva texto; toda selección agrega un tilde; todo error tiene su mensaje.
- **Los errores se dicen donde ocurren:** en el campo con `Campo` o `GrupoOpciones`, y con un `Aviso` de rol `alert` cuando afectan a toda la vista.
- **Iconos, no emojis.** Todo ícono pasa por `Icono`. Cuando un ícono no se explica solo, va con texto o con `accessibilityLabel`.
- **Sin conexión se explica.** Un botón deshabilitado por falta de red lleva `NotaSinConexion` o un `AvisoSinConexion`.
- **Los estados están diseñados.** Toda lista contempla carga, vacío y error con `Cargando`, `EstadoVacio` y `ErrorConReintento`.

## Navegación

- Cinco pestañas: Buscar, Alertas, Seguidas, Reclamos y Perfil, con contador de novedades.
- `Publicar` está en el encabezado de todas las pestañas.
- Todo lo demás se apila sobre las pestañas. Para volver a una pestaña desde una pantalla apilada se usa `irAPestana`.

## Excepciones aceptadas

- `ConversacionReclamoScreen` usa `TextInput` directo porque el campo de mensaje vive en una barra fija y crece con el texto; usa los mismos tokens que `Campo`.
- Los controles de `components/ui/` son los únicos que importan `Text`, `TextInput` y `Pressable` de React Native.
