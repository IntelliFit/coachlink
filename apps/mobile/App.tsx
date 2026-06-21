import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/providers/AuthProvider'
import { RootNavigator } from './src/navigation/RootNavigator'
import { ICON_FONT_FAMILY } from './src/components/IconFont'
import { colors } from './src/theme'

export default function App() {
  const [fontsLoaded] = useFonts({
    [ICON_FONT_FAMILY]: require('./assets/iconfont/iconfont.ttf'),
  })

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
