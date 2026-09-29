'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const router = useRouter()
    const supabase = createClient()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<'login' | 'signup'>('login')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        console.log('Submitting...', { email, mode })
        console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

        if (mode === 'signup') {
            console.log('Attempting signup...')
            const { data, error } = await supabase.auth.signUp({ email, password })
            console.log('Signup result:', { data, error })
            if (error) { setError(error.message); setLoading(false); return }
            router.push('/restaurant/onboarding')
        } else {
            console.log('Attempting signin...')
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })
            console.log('Signin result:', { data, error })
            if (error) { setError(error.message); setLoading(false); return }
            router.push('/restaurant/dashboard')
        }
    }
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#1A6B4A]">Salu</h1>
                    <p className="text-gray-500 mt-1">Restaurant portal</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
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
                        {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                </form>

                <p className="mt-4 text-sm text-center text-gray-500">
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <button
                        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                        className="text-[#1A6B4A] font-medium hover:underline"
                    >
                        {mode === 'login' ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    )
}