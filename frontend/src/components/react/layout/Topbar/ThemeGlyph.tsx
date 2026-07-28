import type { JSX } from 'react/jsx-runtime';
//-- Icons
import { Moon, Sun } from 'lucide-react';
/**
 * Properties for the theme glyph component.
 * @interface ThemeGlyphProps
 * @property {string} theme - The current theme.
 */
interface ThemeGlyphProps {
    theme: 'light' | 'dark';
}
/**
 * The theme glyph component.
 * @param {ThemeGlyphProps} props - The props for the component.
 * @returns {JSX.Element} The rendered component.
 */
export function ThemeGlyph({ theme }: ThemeGlyphProps): JSX.Element {
    return theme === 'dark' ? (
        <Moon size={14} strokeWidth={1.6} />
    ) : (
        <Sun size={14} strokeWidth={1.6} />
    );
}
