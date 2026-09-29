'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MenuCategory, Restaurant } from '@/lib/types'
import Link from 'next/link'

export default function NewMenuItemPage() {
    const router = useRouter()
    const supabase = createClient()

    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [categories, setCategories] = useState<MenuCategory[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Form state
    const [mode, setMode] = useState<'item' | 'category'>('item')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [priceDollars, setPriceDollars] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [newCategoryName, setNewCategoryName] = useState('')

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }

            const { data: r } = await supabase
                .from('restaurants')
                .select('*')
                .eq('owner_user_id', user.id)
                .single()

            if (!r) { router.push('/restaurant/onboarding'); return }
            setRestaurant(r)

            const { data: cats } = await supabase
                .from('menu_categories')
                .select('*')
                .eq('restaurant_id', r.id)
                .order('sort_order')

            setCategories(cats ?? [])
        }
        load()
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!restaurant) return
        setLoading(true)
        setError('')

        if (mode === 'category') {
            const { error } = await supabase
                .from('menu_categories')
                .insert({
                    restaurant_id: restaurant.id,
                    name: newCategoryName,
                    sort_order: categories.length,
                })
            if (error) { setError(error.message); setLoading(false); return }
            router.push('/restaurant/menu')
            return
        }

        // Item mode
        const priceCents = Math.round(parseFloat(priceDollars) * 100)
        if (isNaN(priceCents) || priceCents <= 0) {
            setError('Please enter a valid price')
            setLoading(false)
            return
        }

        const { error } = await supabase
            .from('menu_items')
            .insert({
                restaurant_id: restaurant.id,
                category_id: categoryId || null,
                name,
                description: description || null,
                price_cents: priceCents,
                available: true,
            })

        if (error) { setError(error.message); setLoading(false); return }
        router.push('/restaurant/menu')
    }

    return (
        <div className="min-h-screen bg-[#0F1117]">
            <header className="bg-[#1A1D27] border-b border-white/10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <Link href="/restaurant/menu" className="text-white/40 hover:text-white/70 text-sm transition-colors">
                        ← Menu
                    </Link>
                    <span className="text-white/20">/</span>
                    <span className="text-white/80 font-medium">Add new</span>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Mode toggle */}
                <div className="flex gap-2 mb-8 bg-[#1A1D27] p-1 rounded-lg border border-white/10 w-fit">
                    {(['item', 'category'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${mode === m
                                    ? 'bg-[#2ECC8E] text-[#0F1117]'
                                    : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            {m}
                        </button>
                    ))}
                </div>

                <div className="bg-[#1A1D27] rounded-xl border border-white/10 p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {mode === 'category' ? (
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-1.5">
                                    Category name
                                </label>
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="e.g. Starters, Mains, Desserts"
                                    className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#2ECC8E]/50"
                                    required
                                />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                                        Item name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Grilled Salmon"
                                        className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#2ECC8E]/50"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                                        Description <span className="text-white/30">(optional)</span>
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="e.g. With lemon butter sauce and seasonal vegetables"
                                        rows={2}
                                        className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#2ECC8E]/50 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                                        Price
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-white/40 text-sm">$</span>
                                        <input
                                            type="number"
                                            value={priceDollars}
                                            onChange={e => setPriceDollars(e.target.value)}
                                            placeholder="0.00"
                                            step="0.01"
                                            min="0"
                                            className="w-full bg-[#0F1117] border border-white/10 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#2ECC8E]/50"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                                        Category <span className="text-white/30">(optional)</span>
                                    </label>
                                    <select
                                        value={categoryId}
                                        onChange={e => setCategoryId(e.target.value)}
                                        className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2ECC8E]/50"
                                    >
                                        <option value="">No category</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        {error && <p className="text-red-400 text-sm">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#2ECC8E] text-[#0F1117] rounded-lg py-2.5 text-sm font-semibold hover:bg-[#29b87d] disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Saving...' : mode === 'category' ? 'Create category' : 'Add item'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}