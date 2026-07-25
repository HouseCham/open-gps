import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../client';
import { BootstrapService } from './bootstrap.service';

describe('BootstrapService.getStatus', () => {
    it('unwraps the envelope and returns { needsSetup: true }', async () => {
        const http = vi.fn().mockResolvedValue({
            data: { status_code: 200, message: 'OK', data: true },
        });
        const svc = new BootstrapService(http as unknown as typeof apiClient);

        await expect(svc.getStatus()).resolves.toEqual({ needsSetup: true });
        expect(http).toHaveBeenCalledWith(
            '/system/bootstrap',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('flips a falsy envelope.data to needsSetup: false', async () => {
        const http = vi.fn().mockResolvedValue({
            data: { status_code: 200, message: 'OK', data: false },
        });
        const svc = new BootstrapService(http as unknown as typeof apiClient);

        await expect(svc.getStatus()).resolves.toEqual({ needsSetup: false });
    });

    it('normalizes a thrown Error into a typed ApiError via handleApiError', async () => {
        const http = vi.fn().mockRejectedValue(new Error('boom'));
        const svc = new BootstrapService(http as unknown as typeof apiClient);

        await expect(svc.getStatus()).rejects.toEqual({
            status: 0,
            message: 'boom',
        });
    });
});
