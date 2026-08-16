import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { AppRouter } from "./router/AppRouter"

// Shared React Query client — required by hooks/queries/** (e.g.
// useManagerJobs, used inside Sidebar). refetchOnWindowFocus off so
// switching tabs doesn't re-trigger every query; retry: 1 keeps failed
// requests from hammering the API.
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})

// App entry component — intentionally just renders the router. All real
// logic lives in router/, hooks/, stores/, and api/, not here.

// Root component, delegates everything to AppRouter. Toaster is mounted
// once here so any hook can call toast(...) (sonner) from anywhere in
// the tree.
function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AppRouter />
            <Toaster position="bottom-right" richColors />
        </QueryClientProvider>
    )
}

export default App
