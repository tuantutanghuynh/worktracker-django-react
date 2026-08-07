import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create (
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            user: null,

            login: (tokens, user) => {
                set({
                    accessToken: tokens.access,
                    refreshToken: tokens.refresh,
                    user,
                })
            },

            setAccessToken: (accessToken) => set({ accessToken}),
            setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),


            logout: () => {
                set({ accessToken: null, refreshToken: null, user: null})
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                user: state.user,
            }),
        }
    )
)