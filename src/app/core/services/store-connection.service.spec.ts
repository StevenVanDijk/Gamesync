import { TestBed } from '@angular/core/testing';
import { StoreConnectionService } from './store-connection.service';
import { SteamConnectionConfig } from '../models/store-connection.model';

describe('StoreConnectionService (US-002, US-003, US-008)', () => {
  let service: StoreConnectionService;

  const steamConfig: SteamConnectionConfig = {
    apiKey: 'ABCD1234ABCD1234ABCD1234ABCD1234',
    steamId: '76561198000000001',
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(StoreConnectionService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should start with an empty connections list', () => {
    expect(service.connections()).toEqual([]);
    expect(service.connectionCount()).toBe(0);
  });

  it('should add a Steam connection (US-002)', () => {
    service.add('steam', 'My Steam', steamConfig);
    expect(service.connectionCount()).toBe(1);
    expect(service.connections()[0].type).toBe('steam');
    expect(service.connections()[0].label).toBe('My Steam');
  });

  it('should add a GOG connection (US-023)', () => {
    service.add('gog', 'My GOG', {
      userId: 'user123',
      username: 'GogUser',
      accessToken: 'at_abc',
      refreshToken: 'rt_xyz',
      expiresAt: Date.now() + 3_600_000,
    });
    expect(service.connections()[0].type).toBe('gog');
  });

  it('should persist connections to sessionStorage (US-036)', () => {
    service.add('steam', 'Persisted', steamConfig);
    const raw = sessionStorage.getItem('gamesync_connections');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toHaveLength(1);
    expect(localStorage.getItem('gamesync_connections')).toBeNull();
  });

  it('should migrate legacy localStorage connections to sessionStorage (US-036)', () => {
    localStorage.setItem('gamesync_connections', JSON.stringify([{
      id: 'legacy-1',
      type: 'steam',
      label: 'Legacy Steam',
      config: steamConfig,
    }]));

    const service2 = new StoreConnectionService();

    const stored = JSON.parse(sessionStorage.getItem('gamesync_connections')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe('Legacy Steam');
    expect(localStorage.getItem('gamesync_connections')).toBeNull();
    expect(service2.connections()[0].label).toBe('Legacy Steam');
  });

  it('should remove a connection by id (US-008)', () => {
    const conn = service.add('steam', 'To Remove', steamConfig);
    service.remove(conn.id);
    expect(service.connectionCount()).toBe(0);
  });

  it('should update a connection label (US-008)', () => {
    const conn = service.add('steam', 'Old Label', steamConfig);
    service.update(conn.id, { label: 'New Label' });
    expect(service.connections()[0].label).toBe('New Label');
  });

  it('should handle invalid JSON in sessionStorage gracefully (US-036)', () => {
    sessionStorage.setItem('gamesync_connections', 'invalid json');
    const service2 = new StoreConnectionService();
    expect(service2.connections()).toEqual([]);
    expect(sessionStorage.getItem('gamesync_connections')).toBeNull();
  });

  it('should discard corrupted legacy storage without replacing session data (US-036)', () => {
    localStorage.setItem('gamesync_connections', 'invalid json');
    sessionStorage.setItem('gamesync_connections', JSON.stringify([{
      id: 'session-1',
      type: 'steam',
      label: 'Session Data',
      config: steamConfig,
    }]));

    const service2 = new StoreConnectionService();

    expect(localStorage.getItem('gamesync_connections')).toBeNull();
    expect(service2.connections()[0].label).toBe('Session Data');
  });

  it('should find a connection by id', () => {
    const conn = service.add('steam', 'Find Me', steamConfig);
    expect(service.getById(conn.id)).toBeDefined();
    expect(service.getById('nonexistent')).toBeUndefined();
  });
});
