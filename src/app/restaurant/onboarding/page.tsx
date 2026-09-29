'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function OnboardingPage() {
    const router = useRouter()
    const supabase = createClient()
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const slug = slugify(name)

        const { error } = await supabase
            .from('restaurants')
            .insert({ name, slug, owner_user_id: user.id })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        router.push('/restaurant/dashboard')
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up your restaurant</h1>
                <p className="text-gray-500 text-sm mb-8">You can update these details later.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Casa Grande"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]"
                            required
                        />
                    </div>

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#1A6B4A] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#155a3e] disabled:opacity-50 transition-colors"
                    >
                        {loading ? 'Creating...' : 'Create restaurant'}
                    </button>
                </form>
            </div>
        </div>
    )
}