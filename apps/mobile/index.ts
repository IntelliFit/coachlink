import App from './App'

const registerRootComponentModule = require('expo/src/launch/registerRootComponent')
const registerRootComponent = registerRootComponentModule.default || registerRootComponentModule

registerRootComponent(App)
