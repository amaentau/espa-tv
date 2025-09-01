// Shared TypeScript types for Veo Dongle project

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  lastSeen?: Date;
  ipAddress?: string;
  config?: DeviceConfig;
}

export type DeviceType = 'raspberry-pi' | 'cloud' | 'mobile';

export type DeviceStatus = 'connected' | 'disconnected' | 'unknown' | 'error';

export interface DeviceConfig {
  streamUrl?: string;
  port?: number;
  chromiumArgs?: string[];
}

export interface Command {
  id: string;
  deviceId: string;
  type: CommandType;
  params?: Record<string, any>;
  timestamp: Date;
  status: CommandStatus;
}

export type CommandType = 'play' | 'pause' | 'fullscreen' | 'refresh' | 'status';

export type CommandStatus = 'pending' | 'sent' | 'completed' | 'failed';

export interface StreamControl {
  deviceId: string;
  command: CommandType;
  params?: {
    url?: string;
    volume?: number;
    quality?: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: Date;
  uptime: number;
  connectedDevices: number;
  version: string;
}

export interface SocketMessage {
  type: 'command' | 'status' | 'error' | 'info';
  deviceId?: string;
  payload: any;
  timestamp: Date;
}

// Raspberry Pi specific types
export interface RaspberryPiConfig {
  streamUrl: string;
  port: number;
  chromium: {
    headless: boolean;
    args: string[];
    viewport?: {
      width: number;
      height: number;
    };
  };
  websocket: {
    enabled: boolean;
    port: number;
  };
}

// Cloud service types
export interface CloudConfig {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  corsOrigins: string[];
}

export interface DeviceRegistration {
  deviceId: string;
  name: string;
  type: DeviceType;
  config?: DeviceConfig;
}

// Mobile app types
export interface MobileConfig {
  cloudUrl: string;
  deviceId?: string;
  autoConnect: boolean;
}

export interface ControlCommand {
  deviceId: string;
  command: CommandType;
  params?: Record<string, any>;
}
