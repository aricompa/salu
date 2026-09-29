import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_user_id', user.id)
        .single()

    if (!restaurant) redirect('/restaurant/onboarding')

    return (
        <div className="min-h-screen bg-[#0F1117]">
            {/* Header */}
            <header className="bg-[#1A1D27] border-b border-white/10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <span className="text-xl font-bold text-[#2ECC8E]">Salu</span>
                        <span className="text-white/20 mx-2">·</span>
                        <span className="text-white/80 font-medium">{restaurant.name}</span>
                    </div>
                    <form action="/auth/signout" method="post">
                        <button className="text-sm text-white/40 hover:text-white/70 transition-colors">
                            Sign out
                        </button>
                    </form>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-8">

                {/* Nav cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { emoji: '🪑', label: 'Tables', desc: 'Manage & generate QR codes', href: '/restaurant/tables' },
                        { emoji: '🍽️', label: 'Menu', desc: 'Categories & items', href: '/restaurant/menu' },
                        { emoji: '📋', label: 'Orders', desc: 'Live order feed', href: '/restaurant/orders' },
                        { emoji: '⚙️', label: 'Settings', desc: 'Timers & configuration', href: '/restaurant/settings' },
                    ].map(card => (
                        <Link
                            key={card.label}
                            href={card.href}
                            className="bg-[#1A1D27] rounded-xl border border-white/10 p-4 hover:border-[#2ECC8E]/50 hover:bg-[#1E2130] transition-all group"
                        >
                            <div className="text-2xl mb-3">{card.emoji}</div>
                            <div className="font-medium text-white/90 group-hover:text-[#2ECC8E] transition-colors">
                                {card.label}
                            </div>
                            <div className="text-xs text-white/40 mt-0.5">{card.desc}</div>
                        </Link>
                    ))}
                </div>

                {/* Getting started */}
                <div className="bg-[#1A1D27] rounded-xl border border-white/10 p-6">
                    <h2 className="font-semibold text-white/90 mb-5">Getting started</h2>
                    <ol className="space-y-4">
                        {[
                            { label: 'Create your menu categories and items', href: '/restaurant/menu' },
                            { label: 'Add your tables and generate QR codes', href: '/restaurant/tables' },
                            { label: 'Place a test order by scanning a QR code', href: '/restaurant/tables' },
                        ].map((step, i) => (
                            <li key={i} className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-[#2ECC8E]/15 text-[#2ECC8E] text-xs font-bold flex items-center justify-center flex-shrink-0">
                                    {i + 1}
                                </span>
                                <Link
                                    href={step.href}
                                    className="text-sm text-white/60 hover:text-[#2ECC8E] transition-colors"
                                >
                                    {step.label}
                                </Link>
                            </li>
                        ))}
                    </ol>
                </div>

            </div>
        </div>
    )
}