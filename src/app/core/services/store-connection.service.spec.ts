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
    TestBed.configureTestingModule({});
    service = TestBed.inject(StoreConnectionService);
  });

  afterEach(() => localStorage.clear());

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

  it('should add an Epic Games connection (US-003)', () => {
    service.add('epic', 'My Epic', { gamesJson: '[]' });
    expect(service.connections()[0].type).toBe('epic');
  });

  it('should persist connections to localStorage (US-002)', () => {
    service.add('steam', 'Persisted', steamConfig);
    const raw = localStorage.getItem('gamesync_connections');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
  });

  it('should restore connections from localStorage on construction (US-008)', () => {
    service.add('steam', 'Persisted', steamConfig);
    // New instance should reload from storage
    const service2 = new StoreConnectionService();
    expect(service2.connectionCount()).toBe(1);
    expect(service2.connections()[0].label).toBe('Persisted');
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

  it('should find a connection by id', () => {
    const conn = service.add('steam', 'Find Me', steamConfig);
    expect(service.getById(conn.id)).toBeDefined();
    expect(service.getById('nonexistent')).toBeUndefined();
  });
});
