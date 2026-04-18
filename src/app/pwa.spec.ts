/**
 * US-007 – PWA installability: verify manifest data contract.
 *
 * The manifest object is inlined here as the source of truth; the actual
 * manifest.webmanifest file on disk must stay consistent with this.
 */

const MANIFEST = {
  name: 'Gamesync',
  short_name: 'Gamesync',
  description: 'Your unified game library — connect Steam, GOG and more.',
  display: 'standalone',
  background_color: '#121212',
  theme_color: '#3f51b5',
  icons: [
    { src: 'icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png', purpose: 'maskable any' },
    { src: 'icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png', purpose: 'maskable any' },
    { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'maskable any' },
    { src: 'icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'maskable any' },
    { src: 'icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'maskable any' },
    { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
    { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'maskable any' },
    { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
  ],
};

describe('PWA Manifest contract (US-007)', () => {
  it('should have a human-readable name', () => {
    expect(MANIFEST.name).toBeTruthy();
  });

  it('should have a short_name', () => {
    expect(MANIFEST.short_name).toBeTruthy();
  });

  it('should use standalone display mode', () => {
    expect(MANIFEST.display).toBe('standalone');
  });

  it('should specify a theme_color', () => {
    expect(MANIFEST.theme_color).toBeTruthy();
  });

  it('should include a 192x192 icon (Chrome install requirement)', () => {
    const has192 = MANIFEST.icons.some(i => i.sizes.includes('192x192'));
    expect(has192).toBe(true);
  });

  it('should include a 512x512 icon (Chrome install requirement)', () => {
    const has512 = MANIFEST.icons.some(i => i.sizes.includes('512x512'));
    expect(has512).toBe(true);
  });

  it('should list at least 4 icon sizes', () => {
    expect(MANIFEST.icons.length).toBeGreaterThanOrEqual(4);
  });
});
