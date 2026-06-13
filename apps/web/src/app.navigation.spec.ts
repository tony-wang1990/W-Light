import { describe, expect, it } from 'vitest';
import { PROTECTED_ROUTES } from './App';
import { MENU_ITEMS } from './layouts/AdminLayout';

function duplicates(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe('web navigation map', () => {
  it('keeps every sidebar menu backed by a protected route', () => {
    const routePaths = new Set<string>(PROTECTED_ROUTES.map(route => route.path));
    const menuPaths = MENU_ITEMS.map(item => item.path);

    expect(menuPaths.filter(path => !routePaths.has(path))).toEqual([]);
  });

  it('keeps every protected route visible in the sidebar navigation map', () => {
    const menuPaths = new Set<string>(MENU_ITEMS.map(item => item.path));
    const routePaths = PROTECTED_ROUTES.map(route => route.path);

    expect(routePaths.filter(path => !menuPaths.has(path))).toEqual([]);
  });

  it('does not define duplicate menu or protected route paths', () => {
    expect(duplicates(MENU_ITEMS.map(item => item.path))).toEqual([]);
    expect(duplicates(PROTECTED_ROUTES.map(route => route.path))).toEqual([]);
  });
});
