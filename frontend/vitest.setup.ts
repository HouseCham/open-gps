import { Window } from 'happy-dom';

if (typeof globalThis.localStorage === 'undefined') {
    const storage = new Window().localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
        value: storage,
        writable: true,
        configurable: true,
    });
}
if (
    typeof window !== 'undefined' &&
    typeof window.localStorage === 'undefined'
) {
    Object.defineProperty(window, 'localStorage', {
        value: new Window().localStorage,
        writable: true,
        configurable: true,
    });
}
