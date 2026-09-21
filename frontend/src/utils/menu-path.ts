import type { MenuItem } from '../types/auth'

const builtInMenuPaths: Readonly<Record<string, string>> = {
  // GLI_MENU.MENU_ID = 3 (Số liệu). MENU_URL in the current database is null.
  '3': '/broadband',
}

export function resolveMenuPath(item: MenuItem): string | null {
  return item.path || item.redirect || builtInMenuPaths[item.code] || null
}

export function hasMenuTarget(item: MenuItem): boolean {
  return Boolean(resolveMenuPath(item))
}
