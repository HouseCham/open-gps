import type { JSX } from 'react/jsx-runtime';
/**
 * Props for the RecoveryPipelineSVG component.
 * @interface RecoveryPipelineSVGProps
 * @property {string} status - Status text drawn under the pipeline.
 * @property {string} ttl - Right-aligned "ttl 15m" caption.
 */
export interface RecoveryPipelineSVGProps {
    status: string;
    ttl: string;
}
/**
 * Recovery brand-panel visual: 4-hop pipeline (user → authula → smtp
 * → inbox) with a traveling reset-token dot. Mirrors the structure of
 * `MapSVG` so it slots into the same `.visual` slot of `AuthLayout`.
 * @param {RecoveryPipelineSVGProps} props
 * @returns {JSX.Element}
 */
export function RecoveryPipelineSVG({
    status,
    ttl,
}: RecoveryPipelineSVGProps): JSX.Element {
    return (
        <svg viewBox="0 0 380 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern
                    id="rp-grid"
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                >
                    <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="var(--gp-border)"
                        strokeOpacity=".5"
                        strokeWidth=".5"
                    />
                </pattern>
                <linearGradient id="rp-flow" x1="0" y1="0" x2="1" y2="0">
                    <stop
                        offset="0%"
                        stopColor="var(--gp-route)"
                        stopOpacity=".15"
                    />
                    <stop
                        offset="100%"
                        stopColor="var(--gp-route)"
                        stopOpacity="1"
                    />
                </linearGradient>
            </defs>
            <rect width="380" height="200" fill="url(#rp-grid)" />

            <path
                d="M 40 100 L 340 100"
                fill="none"
                stroke="var(--gp-route)"
                strokeOpacity=".2"
                strokeWidth="4"
                strokeLinecap="round"
            />
            <path
                d="M 40 100 L 340 100"
                fill="none"
                stroke="url(#rp-flow)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="3 4"
            />

            {[
                { x: 40, label: 'user', glyph: 'user' },
                { x: 140, label: 'authula', glyph: 'server' },
                { x: 240, label: 'smtp', glyph: 'mail' },
                { x: 340, label: 'inbox', glyph: 'inbox' },
            ].map(node => (
                <g key={node.label}>
                    <rect
                        x={node.x - 12}
                        y={88}
                        width="24"
                        height="24"
                        rx="6"
                        fill="var(--gp-surface)"
                        stroke="var(--gp-border-strong)"
                        strokeWidth="1"
                    />
                    <g
                        transform={`translate(${node.x - 6} 94)`}
                        stroke="var(--gp-text-mute)"
                        strokeWidth="1.2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        {node.glyph === 'user' && (
                            <>
                                <circle cx="6" cy="4.5" r="2.4" />
                                <path d="M2 12c0-2.2 1.8-4 4-4s4 1.8 4 4" />
                            </>
                        )}
                        {node.glyph === 'server' && (
                            <>
                                <rect
                                    x="1"
                                    y="1.5"
                                    width="10"
                                    height="4.5"
                                    rx="1"
                                />
                                <rect
                                    x="1"
                                    y="7.5"
                                    width="10"
                                    height="4.5"
                                    rx="1"
                                />
                                <path d="M3 3.7h.01M3 9.7h.01" />
                            </>
                        )}
                        {node.glyph === 'mail' && (
                            <>
                                <rect
                                    x="1"
                                    y="2"
                                    width="10"
                                    height="9"
                                    rx="1.2"
                                />
                                <path d="M1 3.5l5 3.5 5-3.5" />
                            </>
                        )}
                        {node.glyph === 'inbox' && (
                            <>
                                <path d="M1 7h3l1 2h4l1-2h3" />
                                <path d="M10 2 12.5 7v4.5H-0.5V7L2 2z" />
                            </>
                        )}
                    </g>
                    <text
                        x={node.x}
                        y={130}
                        textAnchor="middle"
                        fontFamily="var(--gp-mono)"
                        fontSize="9"
                        fill="var(--gp-text-faint)"
                    >
                        {node.label}
                    </text>
                </g>
            ))}

            <circle r="4" fill="var(--gp-accent)">
                <animateMotion
                    dur="4s"
                    repeatCount="indefinite"
                    rotate="auto"
                    path="M 40 100 L 340 100"
                />
            </circle>

            <g transform="translate(20,180)">
                <text
                    fontFamily="var(--gp-mono)"
                    fontSize="10"
                    fill="var(--gp-text-faint)"
                >
                    {status}
                </text>
            </g>
            <g transform="translate(220,180)">
                <text
                    fontFamily="var(--gp-mono)"
                    fontSize="10"
                    fill="var(--gp-text-faint)"
                >
                    {ttl}
                </text>
            </g>
        </svg>
    );
}
