import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { estilosPantalla } from './tema';

// Pantalla desplazable con el margen común. Deja lugar al teclado en los formularios.
export default function Pantalla({ children, estiloContenido = undefined, ...props }) {
  return (
    <KeyboardAvoidingView
      style={estilosPantalla.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={estilosPantalla.pantalla}
        contentContainerStyle={[estilosPantalla.contenido, estiloContenido]}
        keyboardShouldPersistTaps="handled"
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
