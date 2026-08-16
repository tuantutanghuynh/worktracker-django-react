import { useState, useEffect } from "react"
import { getPersonalKPI } from "../api/dashboardApi"
import { getErrorMessage } from "../utils/errorMessages"

// Employee dashboard summary — fetches Personal KPI once on mount.
// Read-only page, unlike useProfile: no save/update actions needed.
export function useDashboard() {
    const [kpi, setKpi] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        async function loadKpi() {
            try {
                const data = await getPersonalKPI()
                if (cancelled) return
                setKpi(data)
            } catch (err) {
                if (cancelled) return
                setError(getErrorMessage(err, "Failed to load dashboard"))
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadKpi()

        return () => {
            cancelled = true
        }
    }, [])

    return { kpi, loading, error }
}
