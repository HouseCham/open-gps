import { atom } from 'nanostores';

export const $sidebarOpen = atom<boolean>(false);

export function openSidebar(): void {
    $sidebarOpen.set(true);
}

export function closeSidebar(): void {
    $sidebarOpen.set(false);
}

export function toggleSidebar(): void {
    $sidebarOpen.set(!$sidebarOpen.get());
}
