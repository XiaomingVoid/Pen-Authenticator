export declare const EVENT_SOFT_KEYBOARD: string
export declare function openSoftKeyboard(
    getData: () => string,
    onConfirm: (value: string) => void,
    validate?: (value: string) => string,
    extraOptions?: Record<string, any>
): void
