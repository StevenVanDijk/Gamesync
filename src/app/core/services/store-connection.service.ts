import { Injectable, signal, computed } from '@angular/core';
import { StoreConnection, StoreType } from '../models/store-connection.model';

const STORAGE_KEY = 'gamesync_connections';

function generateId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

@Injectable({ providedIn: 'root' })
export class StoreConnectionService {
  private readonly _connections = signal<StoreConnection[]>(this.load());

  readonly connections = this._connections.asReadonly();
  readonly connectionCount = computed(() => this._connections().length);

  add(
    type: StoreType,
    label: string,
    config: StoreConnection['config'],
  ): StoreConnection {
    const connection: StoreConnection = {
      id: generateId(),
      type,
      label,
      config,
    };
    this._connections.update(list => {
      const updated = [...list, connection];
      this.persist(updated);
      return updated;
    });
    return connection;
  }

  update(id: string, partial: Partial<Pick<StoreConnection, 'label' | 'config' | 'lastSyncedAt'>>): void {
    this._connections.update(list => {
      const updated = list.map(c => (c.id === id ? { ...c, ...partial } : c));
      this.persist(updated);
      return updated;
    });
  }

  remove(id: string): void {
    this._connections.update(list => {
      const updated = list.filter(c => c.id !== id);
      this.persist(updated);
      return updated;
    });
  }

  getById(id: string): StoreConnection | undefined {
    return this._connections().find(c => c.id === id);
  }

  private load(): StoreConnection[] {
    const legacy = this.read(localStorage);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}

    const current = this.read(sessionStorage);
    if (current) return current;
    if (legacy) {
      this.persist(legacy);
      return legacy;
    }
    return [];
  }

  private read(storage: Storage): StoreConnection[] | null {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        storage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed as StoreConnection[];
    } catch {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {}
      return null;
    }
  }

  private persist(connections: StoreConnection[]): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    } catch {
      // storage quota exceeded – skip
    }
  }
}
