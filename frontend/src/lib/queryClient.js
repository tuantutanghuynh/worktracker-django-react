import { QueryClient } from "@tanstack/react-query"

// Shared React Query client — imported both by App.jsx (to provide it to
// the tree) and by stores/authStore.js (so login()/logout() can clear
// every cached query). Lives in its own module, not inline in App.jsx,
// specifically so authStore.js can import it without going through the
// component tree.
//
// refetchOnWindowFocus off so switching tabs doesn't re-trigger every
// query; retry: 1 keeps failed requests from hammering the API.
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})
