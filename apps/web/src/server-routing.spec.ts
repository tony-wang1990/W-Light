import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROTECTED_ROUTES } from './App';

const nginxConfig = readFileSync('nginx.conf', 'utf8');

describe('production server routing contract', () => {
  it('keeps the downloads admin route separate from client artifact files', () => {
    expect(nginxConfig).toContain('location = /downloads {');
    expect(nginxConfig).toContain('location = /downloads/ {');
    expect(nginxConfig).toContain('location ^~ /downloads/ {');
    expect(nginxConfig).toMatch(/location = \/downloads\s*\{\s*try_files \/index\.html =404;/);
    expect(nginxConfig).toMatch(/location = \/downloads\/\s*\{\s*try_files \/index\.html =404;/);
    expect(nginxConfig).toMatch(/location \^~ \/downloads\/\s*\{[\s\S]*?try_files \$uri =404;/);
  });

  it('does not redirect SPA routes to matching physical directories', () => {
    const fallbackLocation = nginxConfig.match(/location \/ \{([\s\S]*?)\n\s{4}\}/)?.[1] || '';
    expect(fallbackLocation).toContain('try_files $uri /index.html;');
    expect(fallbackLocation).not.toContain('$uri/');
  });

  it('does not place another admin route under the artifact namespace', () => {
    const conflicting = PROTECTED_ROUTES
      .map(route => route.path)
      .filter(path => path.startsWith('/downloads/') && path !== '/downloads');
    expect(conflicting).toEqual([]);
  });
});
