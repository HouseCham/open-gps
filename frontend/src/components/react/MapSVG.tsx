import type { JSX } from 'react/jsx-runtime';
/**
 * Props for the MapSVG component
 * @interface MapSVGProps
 * @param {string} status - The status of the map
 */
interface MapSVGProps {
    status: string;
}
/**
 * Returns the SVG for the map.
 * @param {MapSVGProps} props
 * @returns {JSX.Element} The SVG element.
 */
export function MapSVG({ status }: MapSVGProps): JSX.Element {
    return (
        <svg viewBox="0 0 380 220" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern
                    id="gp-grid"
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                >
                    <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="var(--gp-border)"
                        stroke-opacity=".5"
                        stroke-width=".5"
                    ></path>
                </pattern>
                <linearGradient id="gp-track" x1="0" y1="0" x2="1" y2="0">
                    <stop
                        offset="0%"
                        stop-color="var(--gp-route)"
                        stop-opacity=".3"
                    ></stop>
                    <stop
                        offset="100%"
                        stop-color="var(--gp-route)"
                        stop-opacity="1"
                    ></stop>
                </linearGradient>
            </defs>
            <rect width="380" height="220" fill="url(#gp-grid)"></rect>
            <path
                d="M 30 170 Q 70 140 110 150 T 200 100 T 300 60 T 350 80"
                fill="none"
                stroke="var(--gp-route)"
                stroke-opacity=".25"
                stroke-width="6"
                stroke-linecap="round"
            ></path>
            <path
                d="M 30 170 Q 70 140 110 150 T 200 100 T 300 60 T 350 80"
                fill="none"
                stroke="url(#gp-track)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-dasharray="4 4"
            ></path>
            {[
                ['30', '170', 'A'],
                ['110', '150', 'B'],
                ['200', '100', 'C'],
                ['300', '60', 'D'],
                ['350', '80', 'E'],
            ].map(([x, y, l]) => (
                <g key={l}>
                    <circle
                        cx={x}
                        cy={y}
                        r="3.5"
                        fill="var(--gp-surface)"
                        stroke="var(--gp-route)"
                        stroke-width="1.5"
                    ></circle>
                    <text
                        x={Number(x) + 7}
                        y={Number(y) + 3}
                        font-family="var(--gp-mono)"
                        font-size="9"
                        fill="var(--gp-text-faint)"
                    >
                        {l}
                    </text>
                </g>
            ))}
            <circle r="5" fill="var(--gp-accent)">
                <animateMotion
                    dur="6s"
                    repeatCount="indefinite"
                    rotate="auto"
                    path="M 30 170 Q 70 140 110 150 T 200 100 T 300 60 T 350 80"
                ></animateMotion>
            </circle>
            <g transform="translate(20,200)">
                <text
                    font-family="var(--gp-mono)"
                    font-size="10"
                    fill="var(--gp-text-faint)"
                >
                    {status}
                </text>
            </g>
        </svg>
    );
}
