import { AppRouter } from "./router/AppRouter"

// App entry component — intentionally just renders the router. All real
// logic lives in router/, hooks/, stores/, and api/, not here.

// Root component, delegates everything to AppRouter.
function App() {
    return <AppRouter />
}

export default App
