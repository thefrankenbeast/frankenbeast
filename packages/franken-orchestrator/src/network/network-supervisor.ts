import type { NetworkServiceDefinition, ResolvedNetworkService } from './network-registry.js';
import { resolveServiceHealth, type NetworkServiceHealthStatus } from './network-health.js';
import {
  NetworkStateStore,
  type ManagedNetworkServiceState,
  type NetworkOperatorState,
} from './network-state-store.js';
import { NetworkLogStore } from './network-logs.js';

export interface StartServiceOptions {
  detached: boolean;
  logFile?: string | undefined;
}

export interface NetworkSupervisorDeps {
  stateStore: NetworkStateStore;
  logStore: NetworkLogStore;
  startService: (
    service: ResolvedNetworkService,
    options: StartServiceOptions,
  ) => Promise<{ pid: number }>;
  stopService: (service: ManagedNetworkServiceState) => Promise<void>;
  healthcheck: (service: ManagedNetworkServiceState) => Promise<boolean>;
  now?: () => string;
}

export interface NetworkSupervisorStatus {
  mode?: NetworkOperatorState['mode'];
  secureBackend?: string;
  services: NetworkServiceHealthStatus[];
}

export class NetworkSupervisor {
  private readonly now: () => string;

  constructor(private readonly deps: NetworkSupervisorDeps) {
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  async up(options: {
    services: ResolvedNetworkService[];
    detached: boolean;
    mode: NetworkOperatorState['mode'];
    secureBackend: string;
  }): Promise<NetworkOperatorState> {
    const startedAt = this.now();
    const services: ManagedNetworkServiceState[] = [];

    for (const service of options.services) {
      const logFile = options.detached ? await this.deps.logStore.register(service.id) : undefined;
      const { pid } = await this.deps.startService(service, {
        detached: options.detached,
        ...(logFile ? { logFile } : {}),
      });
      services.push({
        id: service.id,
        pid,
        dependsOn: [...service.dependsOn],
        startedAt,
        ...(logFile ? { logFile } : {}),
        ...(service.runtimeConfig.url ? { url: service.runtimeConfig.url } : {}),
      });
    }

    const state: NetworkOperatorState = {
      mode: options.mode,
      secureBackend: options.secureBackend,
      detached: options.detached,
      startedAt,
      services,
    };

    if (options.detached) {
      await this.deps.stateStore.save(state);
    }

    return state;
  }

  async stopAll(state: NetworkOperatorState): Promise<void> {
    for (const service of [...state.services].reverse()) {
      await this.deps.stopService(service);
    }
  }

  async down(): Promise<void> {
    const state = await this.deps.stateStore.load();
    if (!state) {
      return;
    }

    await this.stopAll(state);
    await this.deps.stateStore.clear();
  }

  async status(_registry?: Map<string, NetworkServiceDefinition>): Promise<NetworkSupervisorStatus> {
    const state = await this.deps.stateStore.load();
    if (!state) {
      return { services: [] };
    }

    const services = await Promise.all(
      state.services.map((service) => resolveServiceHealth(service, this.deps.healthcheck)),
    );

    return {
      mode: state.mode,
      secureBackend: state.secureBackend,
      services,
    };
  }
}
