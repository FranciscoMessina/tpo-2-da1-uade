import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import ProfileScreen from './screens/ProfileScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#F3F4F6' }}
      >
        <StatusBar style="dark" />
        <ProfileScreen />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}