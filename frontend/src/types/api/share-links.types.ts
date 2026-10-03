import type { DevicePresenceState } from './locations.types';

export interface DeviceShareLink {
    id: string;
    created_at: string;
    expires_at: string;
}

export interface CreatedDeviceShareLink extends DeviceShareLink {
    token: string;
}

export interface GuestLocation {
    recorded_at: string;
    latitude: number;
    longitude: number;
}

export interface GuestLiveSnapshot {
    device_name: string;
    location: GuestLocation | null;
    presence: {
        state: DevicePresenceState;
    };
    server_time: string;
}
