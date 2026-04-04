/**
 * US-009 – Production build configuration.
 *
 * Verifies that the project has a valid production build setup so that
 * `npm run build` can be expected to succeed.
 */

import angularJson from '../../angular.json';
import packageJson from '../../package.json';

describe('Build configuration (US-009)', () => {
  it('should have a build script in package.json', () => {
    expect((packageJson.scripts as Record<string, string>)['build']).toBeTruthy();
  });

  it('should use the Angular application builder', () => {
    const project = (angularJson as any).projects?.['gamesync'];
    const builder = project?.architect?.build?.builder;
    expect(builder).toBe('@angular/build:application');
  });

  it('should define a production build configuration', () => {
    const project = (angularJson as any).projects?.['gamesync'];
    const prodConfig = project?.architect?.build?.configurations?.production;
    expect(prodConfig).toBeDefined();
  });

  it('should have the service worker enabled in production', () => {
    const project = (angularJson as any).projects?.['gamesync'];
    const prodConfig = project?.architect?.build?.configurations?.production;
    expect(prodConfig?.serviceWorker).toBeTruthy();
  });

  it('should have a browser entry point', () => {
    const project = (angularJson as any).projects?.['gamesync'];
    const buildOptions = project?.architect?.build?.options;
    expect(buildOptions?.browser).toBeTruthy();
  });
});
