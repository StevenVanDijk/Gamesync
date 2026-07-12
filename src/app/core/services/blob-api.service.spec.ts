/**
 * US-028 – BlobApiService frontend unit tests.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BlobApiService, BLOB_BACKEND_URL } from './blob-api.service';
import { BlobConnectionConfig } from '../models/store-connection.model';
import { LoggingService } from './logging.service';

const TEST_BLOB = 'http://test-blob/api/blob';
const SAS_URL = 'https://mystorage.blob.core.windows.net/c/games.csv?sv=test&sig=abc';
const CONN_ID = 'blob_conn_1';
const config: BlobConnectionConfig = { url: SAS_URL };

describe('BlobApiService (US-028, US-035)', () => {
  let service: BlobApiService;
  let httpMock: HttpTestingController;
  let logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { info: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BLOB_BACKEND_URL, useValue: TEST_BLOB },
        { provide: LoggingService, useValue: logger },
      ],
    });
    service = TestBed.inject(BlobApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should send the SAS URL in a POST body instead of the request URL (US-035)', () => {
    service.getOwnedGames(config, CONN_ID).subscribe();

    const req = httpMock.expectOne(r => r.url === `${TEST_BLOB}/library`);
    expect(req.request.method).toBe('POST');
    expect(req.request.urlWithParams).toBe(`${TEST_BLOB}/library`);
    expect(req.request.body).toEqual({ url: SAS_URL });
    req.flush({ games: [] });
  });

  it('should map response games to Game objects with correct ids', () => {
    let result: any[] = [];
    service.getOwnedGames(config, CONN_ID).subscribe(games => (result = games));

    httpMock.expectOne(r => r.url.includes('/library')).flush({
      games: [
        { name: 'Team Fortress 2', source: 'steam', hoursPlayed: 120.5 },
        { name: 'The Witcher 3', source: 'gog', hoursPlayed: 34 },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: `${CONN_ID}_team_fortress_2`,
      appId: 'team_fortress_2',
      storeId: CONN_ID,
      name: 'Team Fortress 2',
      hoursPlayed: 120.5,
      csvSource: 'steam',
    });
    expect(result[1]).toMatchObject({
      id: `${CONN_ID}_the_witcher_3`,
      appId: 'the_witcher_3',
      name: 'The Witcher 3',
      hoursPlayed: 34,
      csvSource: 'gog',
    });
  });

  it('should set csvSource to undefined when source is empty', () => {
    let result: any[] = [];
    service.getOwnedGames(config, CONN_ID).subscribe(games => (result = games));

    httpMock.expectOne(r => r.url.includes('/library')).flush({
      games: [{ name: 'Fortnite', source: '', hoursPlayed: 0 }],
    });

    expect(result[0].csvSource).toBeUndefined();
  });

  it('should return an empty array when the response has no games', () => {
    let result: any[] = [{ id: 'sentinel' }];
    service.getOwnedGames(config, CONN_ID).subscribe(games => (result = games));
    httpMock.expectOne(r => r.url.includes('/library')).flush({ games: [] });
    expect(result).toHaveLength(0);
  });

  it('should propagate HTTP errors without logging credential-bearing details (US-035)', () => {
    let caught = false;
    service.getOwnedGames(config, CONN_ID).subscribe({ error: () => (caught = true) });

    httpMock.expectOne(r => r.url.includes('/library')).flush(
      { error: 'Bad Request', detail: SAS_URL },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(caught).toBe(true);
    expect(logger.error).toHaveBeenCalledWith('Blob', 'library failed — HTTP 400');
  });
});
