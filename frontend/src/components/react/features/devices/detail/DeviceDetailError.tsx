//-- Types
import type { JSX } from 'react/jsx-runtime';
//-- Components
import { Button } from '@/components/react/ui/button';
//-- Icons
import { AlertTriangle } from 'lucide-react';
/**
 * Props for the DeviceDetailError component
 * @interface DeviceDetailErrorProps
 * @prop {string} message - The error message
 * @prop {string} retryLabel - The label for the retry button
 * @prop {() => void} onRetry - Callback for the retry button
 */
interface DeviceDetailErrorProps {
    message: string;
    retryLabel: string;
    onRetry?: () => void;
}
/**
 * DeviceDetailError component
 * @param {DeviceDetailErrorProps} props - Props for the DeviceDetailError component.
 * @returns {JSX.Element} The rendered DeviceDetailError component
 */
export function DeviceDetailError({
    message,
    onRetry,
    retryLabel,
}: DeviceDetailErrorProps): JSX.Element {
    return (
        <div className="dd-error" role="alert">
            <AlertTriangle size={16} />
            <span>{message}</span>
            {onRetry && (
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onRetry}
                >
                    {retryLabel}
                </Button>
            )}
        </div>
    );
}
