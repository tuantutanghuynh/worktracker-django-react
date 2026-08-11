import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Global auth state store (Zustand + persist middleware). Holds the
// access/refresh tokens and the logged-in user. Where they're persisted
// depends on "Remember me" at login: localStorage (survives closing the
// browser, up to the 7-day refresh token lifetime) or sessionStorage
// (cleared when the tab/browser closes). Read via useAuth() inside
// components, or useAuthStore.getState() in plain JS files.

const REMEMBER_ME_KEY = "auth-remember-me"

// Always read/written directly to localStorage (never sessionStorage) —
// this flag has to survive independently of where the actual auth data
// lives, so the storage picker below knows which engine to check.
function getRememberMe() {
    return localStorage.getItem(REMEMBER_ME_KEY) === "true"
}

// Raw storage-like object whose getItem/setItem re-check getRememberMe()
// on every call (not once at store creation) — this is what makes the
// checkbox's choice apply live, unlike passing localStorage directly to
// createJSONStorage.
const dynamicRawStorage = {
    getItem: (name) => (getRememberMe() ? localStorage : sessionStorage).getItem(name),
    setItem: (name, value) => (getRememberMe() ? localStorage : sessionStorage).setItem(name, value),
    removeItem: (name) => {
        localStorage.removeItem(name)
        sessionStorage.removeItem(name)
    },
}

export const useAuthStore = create(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            user: null,

            // Called right after a successful login API response.
            // rememberMe decides localStorage vs sessionStorage for this
            // session — must be set BEFORE the state update below, so the
            // persist middleware's write picks the right engine. Also
            // wipes the OTHER engine, so a stale token set from a previous
            // login with a different Remember-me choice doesn't linger.
            login: (tokens, user, rememberMe = false) => {
                localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "true" : "false")
                const otherStorage = rememberMe ? sessionStorage : localStorage
                otherStorage.removeItem("auth-storage")
                set({
                    accessToken: tokens.access,
                    refreshToken: tokens.refresh,
                    user,
                })
            },

            setAccessToken: (accessToken) => set({ accessToken}),
            setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
            setUser: (user) => set({ user }),

            // Clears all auth state and wipes both possible storage
            // locations, so no stale session survives in either engine.
            logout: () => {
                localStorage.removeItem(REMEMBER_ME_KEY)
                localStorage.removeItem("auth-storage")
                sessionStorage.removeItem("auth-storage")
                set({ accessToken: null, refreshToken: null, user: null})
            },
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => dynamicRawStorage),
            partialize: (state) => ({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                user: state.user,
            }),
        }
    )
)
