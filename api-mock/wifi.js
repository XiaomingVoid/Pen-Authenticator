// Browser UI fixture only: no claim about the host computer's physical Wi-Fi.
class Wifi {
  isOpen() { return false }
  isConnected() { return false }
  getIP() { return '' }
  getWifiQual() { return 'unavailable' }
  getState() { return undefined }
}
export default { Wifi }
