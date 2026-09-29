import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function MenuPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_user_id', user.id)
        .single()

    if (!restaurant) redirect('/restaurant/onboarding')

    const { data: categories } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('sort_order')

    const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('name')

    return (
        <div className="min-h-screen bg-[#0F1117]">
            <header className="bg-[#1A1D27] border-b border-white/10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/restaurant/dashboard" className="text-white/40 hover:text-white/70 text-sm transition-colors">
                            ← Dashboard
                        </Link>
                        <span className="text-white/20">/</span>
                        <span className="text-white/80 font-medium">Menu</span>
                    </div>
                    <Link
                        href="/restaurant/menu/new"
                        className="bg-[#2ECC8E] text-[#0F1117] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#29b87d] transition-colors"
                    >
                        + Add item
                    </Link>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-8">
                {(!categories || categories.length === 0) ? (
                    <div className="bg-[#1A1D27] rounded-xl border border-white/10 p-12 text-center">
                        <div className="text-4xl mb-4">🍽️</div>
                        <p className="text-white/60 mb-6">No menu items yet.</p>
                        <Link
                            href="/restaurant/menu/new"
                            className="bg-[#2ECC8E] text-[#0F1117] text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#29b87d] transition-colors"
                        >
                            Add your first item
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {categories.map(category => {
                            const categoryItems = items?.filter(i => i.category_id === category.id) ?? []
                            return (
                                <div key={category.id}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-white/90 font-semibold text-lg">{category.name}</h2>
                                        <span className="text-white/30 text-sm">{categoryItems.length} items</span>
                                    </div>
                                    <div className="bg-[#1A1D27] rounded-xl border border-white/10 divide-y divide-white/5">
                                        {categoryItems.length === 0 ? (
                                            <p className="px-4 py-3 text-sm text-white/30">No items in this category yet.</p>
                                        ) : (
                                            categoryItems.map(item => (
                                                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white/90 text-sm font-medium">{item.name}</span>
                                                            {!item.available && (
                                                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                                                    86'd
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.description && (
                                                            <p className="text-white/40 text-xs mt-0.5">{item.description}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-[#2ECC8E] text-sm font-medium">
                                                            ${(item.price_cents / 100).toFixed(2)}
                                                        </span>
                                                        <Link
                                                            href={`/restaurant/menu/${item.id}/edit`}
                                                            className="text-white/30 hover:text-white/70 text-xs transition-colors"
                                                        >
                                                            Edit
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}