import { Lock } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

/**
 * Props for the ApiInspector component.
 * @interface ApiInspectorProps
 */
interface ApiInspectorProps {
    method: string;
    path: string;
    body?: Record<string, unknown>;
    extra?: ReactNode;
    title: string;
    cookieNote: string;
}

/**
 * Developer-facing panel that shows the HTTP request the form is about to send.
 * @param {ApiInspectorProps} props
 * @returns {JSX.Element}
 */
export function ApiInspector({
    method,
    path,
    body,
    extra,
    title,
    cookieNote,
}: ApiInspectorProps): JSX.Element {
    return (
        <div className="api-inspector">
            <div className="head">
                <span className="pulse" />
                {title}
            </div>
            <div className="row">
                <span className="k">method</span>
                <span className="v">
                    <span className="method">{method}</span>
                </span>
            </div>
            <div className="row">
                <span className="k">path</span>
                <span className="v mono">{path}</span>
            </div>
            {body && (
                <div className="row">
                    <span className="k">body</span>
                    <span className="v">
                        <pre>{JSON.stringify(body, null, 2)}</pre>
                    </span>
                </div>
            )}
            <div className="row">
                <span className="k">creds</span>
                <span className="v mono">credentials: 'include'</span>
            </div>
            <div className="note">
                <Lock className="icon-14" />
                {cookieNote}
            </div>
            {extra}
        </div>
    );
}
