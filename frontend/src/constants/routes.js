// Shared route path constants — use these instead of hardcoding strings in hooks and components.

// Static route paths used for navigation and redirect guards.
export const ROUTES = {
  LOGIN: '/login',
  CHANGE_PASSWORD: '/change-password',
  UNAUTHORIZED: '/unauthorized',
}

// Default landing page per role after login. Frozen to prevent accidental mutation.
export const ROLE_DASHBOARD = Object.freeze({
  ADMIN: '/admin',
  MANAGER: '/manager',
  EMPLOYEE: '/emp',
})
