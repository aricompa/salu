import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TablesClient from './TablesClient'

export default async function TablesPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_user_id', user.id)
        .single()

    if (!restaurant) redirect('/restaurant/onboarding')

    const { data: tables } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('table_number')

    return (
        <div className="min-h-screen bg-[#0F1117]">
            <header className="bg-[#1A1D27] border-b border-white/10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/restaurant/dashboard" className="text-white/40 hover:text-white/70 text-sm transition-colors">
                            ← Dashboard
                        </Link>
                        <span className="text-white/20">/</span>
                        <span className="text-white/80 font-medium">Tables</span>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-8">
                <TablesClient
                    tables={tables ?? []}
                    restaurant={restaurant}
                />
            </div>
        </div>
    )
}