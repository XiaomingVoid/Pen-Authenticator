/**
 * $am browser mock. Import name verified on firmware 4.9.9 / Falcon 1.6.3.
 * Values and stack operations are UI fixtures, not device state or permissions.
 */
const listeners = { topApp: [], windowAttachState: [] }

export default {
  getTopApp() {
    return (typeof $appid !== 'undefined' && $appid) || '8000000000000000'
  },
  hasWindowFocus() { return true },
  isAttachedToWindow() { return true },
  moveToBack(appId) { console.log(`[mock] $am.moveToBack(${appId || 'self'})`) },
  hide(appId) { console.log(`[mock] $am.hide(${appId || 'self'})`) },
  closeApp(appId, forceFinish) { console.log(`[mock] $am.closeApp(${appId || 'self'}, ${forceFinish})`) },
  on(event, callback) {
    if (listeners[event]) listeners[event].push(callback)
  }
}
