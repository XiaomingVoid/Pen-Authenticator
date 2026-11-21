export const EVENT_SOFT_KEYBOARD = 'softKeyboard'

let nextSessionId = 1

export function openSoftKeyboard(getData, onConfirm, validate, extraOptions) {
    const sessionId = 'kb_' + (nextSessionId++) + '_' + Date.now()
    const initial = typeof getData === 'function' ? (getData() || '') : String(getData || '')
    const opts = Object.assign({}, extraOptions || {}, {
        sessionId,
        data: initial
    })
    const handler = payload => {
        const isObj = payload && typeof payload === 'object'
        if (isObj && payload.sessionId != null && payload.sessionId !== sessionId) return
        try {
            $falcon.off(EVENT_SOFT_KEYBOARD, handler)
        } catch (e) { /* 忽略 */ }
        if (isObj && payload.cancelled) return
        const val = isObj ? payload.value : payload
        if (typeof validate === 'function') {
            const err = validate(val)
            if (err) return
        }
        if (typeof onConfirm === 'function') {
            onConfirm(val)
        }
    }
    $falcon.on(EVENT_SOFT_KEYBOARD, handler)
    $falcon.navTo('softKeyboard', opts)
}
