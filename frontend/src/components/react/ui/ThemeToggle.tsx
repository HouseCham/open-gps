import { useTheme } from '@/lib/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';
import type { JSX } from 'react/jsx-runtime';

/**
 * ThemeToggle — sun/moon icon button that reads/writes the data-theme attribute.
 * Must be hydrated client:load so it is interactive immediately.
 */
export function ThemeToggle(): JSX.Element {
    const [theme, , toggleTheme] = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            className="gp-iconbtn"
            onClick={toggleTheme}
            aria-label={
                isDark ? 'Switch to light theme' : 'Switch to dark theme'
            }
            title={isDark ? 'Light' : 'Dark'}
            type="button"
        >
            {isDark ? (
                <Sun className="icon-16" strokeWidth={1.6} />
            ) : (
                <Moon className="icon-16" strokeWidth={1.6} />
            )}
        </button>
    );
}
