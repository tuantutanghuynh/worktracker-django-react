import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Editable profile fields (full_name, phone_number) — the only 2 fields
// the backend lets employees self-edit. Pure component: receives
// current values + save callback via props, never calls the API itself.
const profileFormSchema = z.object({
    full_name: z.string().min(1, "Full name is required"),
    phone_number: z.string().optional(),
})

export function ProfileFormCard({ profile, onSave, saving, error }) {
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(profileFormSchema),
        values: { full_name: profile?.full_name ?? "", phone_number: profile?.phone_number ?? "" },
    })

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
            <form onSubmit={handleSubmit(onSave)} className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium"
                        {...register("full_name")}
                    />
                    {errors.full_name && <p className="text-[11px] text-rose-500 mt-1">{errors.full_name.message}</p>}
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium"
                        {...register("phone_number")}
                    />
                </div>
                {error && <p className="text-[11px] text-rose-500">{error}</p>}
                <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-xs shadow-md shadow-blue-600/30 transition disabled:opacity-60"
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </form>
        </div>
    )
}
