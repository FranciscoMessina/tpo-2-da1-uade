import { registerRootComponent } from 'expo';

// Define las tareas en segundo plano en el ámbito global, antes de montar la app: cuando el
// sistema arranca el bundle sin interfaz (headless) para correr una tarea, solo se evalúa esto.
import './services/respaldoSegundoPlano';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
