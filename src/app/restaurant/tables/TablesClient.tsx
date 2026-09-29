'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Table, Restaurant } from '@/lib/types'
import QRCode from 'qrcode'

type Props = {
    tables: Table[]
    restaurant: Restaurant
}

export default function TablesClient({ tables: initialTables, restaurant }: Props) {
    const router = useRouter()
    const supabase = createClient()

    const [tables, setTables] = useState<Table[]>(initialTables)
    const [tableNumber, setTableNumber] = useState('')
    const [capacity, setCapacity] = useState('')
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState('')
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
    const [qrTableLabel, setQrTableLabel] = useState('')
    const [generatingId, setGeneratingId] = useState<string | null>(null)

    async function handleAddTable(e: React.FormEvent) {
        e.preventDefault()
        setAdding(true)
        setError('')

        const { data, error } = await supabase
            .from('tables')
            .insert({
                restaurant_id: restaurant.id,
                table_number: tableNumber,
                capacity: capacity ? parseInt(capacity) : null,
                status: 'available',
            })
            .select()
            .single()

        if (error) { setError(error.message); setAdding(false); return }

        setTables(prev => [...prev, data])
        setTableNumber('')
        setCapacity('')
        setAdding(false)
    }

    async function handleGenerateQR(table: Table) {
        setGeneratingId(table.id)

        // Create a new session for this table
        const { data: session, error } = await supabase
            .from('sessions')
            .insert({
                restaurant_id: restaurant.id,
                table_id: table.id,
                status: 'open',
            })
            .select()
            .single()

        if (error || !session) {
            setGeneratingId(null)
            return
        }

        // Generate QR code pointing to diner web app
        const url = `${window.location.origin}/r/${restaurant.slug}/table/${session.id}`
        const dataUrl = await QRCode.toDataURL(url, {
            width: 400,
            margin: 2,
            color: {
                dark: '#0F1117',
                light: '#FFFFFF',
            },
        })

        setQrDataUrl(dataUrl)
        setQrTableLabel(`Table ${table.table_number}`)
        setGeneratingId(null)
    }

    function handlePrintQR() {
        if (!qrDataUrl) return
        const win = window.open('', '_blank')
        if (!win) return
        win.document.write(`
      <html>
        <head>
          <title>QR Code — ${qrTableLabel}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: system-ui, sans-serif; background: white; }
            img { width: 300px; height: 300px; }
            h2 { margin-top: 16px; font-size: 24px; color: #0F1117; }
            p { color: #666; font-size: 14px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <img src="${qrDataUrl}" />
          <h2>${qrTableLabel}</h2>
          <p>Scan to view menu and order</p>
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `)
        win.document.close()
    }

    return (
        <div>
            {/* Add table form */}
            <div className="bg-[#1A1D27] rounded-xl border border-white/10 p-6 mb-8">
                <h2 className="text-white/90 font-semibold mb-4">Add a table</h2>
                <form onSubmit={handleAddTable} className="flex gap-3 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-white/50 mb-1.5">Table number / name</label>
                        <input
                            type="text"
                            value={tableNumber}
                            onChange={e => setTableNumber(e.target.value)}
                            placeholder="e.g. 1, A4, Bar 2"
                            className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#2ECC8E]/50"
                            required
                        />
                    </div>
                    <div className="w-28">
                        <label className="block text-xs font-medium text-white/50 mb-1.5">Capacity</label>
                        <input
                            type="number"
                            value={capacity}
                            onChange={e => setCapacity(e.target.value)}
                            placeholder="e.g. 4"
                            min="1"
                            className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#2ECC8E]/50"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={adding}
                        className="bg-[#2ECC8E] text-[#0F1117] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#29b87d] disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                        {adding ? 'Adding...' : '+ Add table'}
                    </button>
                </form>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            {/* Tables list */}
            {tables.length === 0 ? (
                <div className="bg-[#1A1D27] rounded-xl border border-white/10 p-12 text-center">
                    <div className="text-4xl mb-4">🪑</div>
                    <p className="text-white/40">No tables yet. Add one above.</p>
                </div>
            ) : (
                <div className="bg-[#1A1D27] rounded-xl border border-white/10 divide-y divide-white/5">
                    {tables.map(table => (
                        <div key={table.id} className="flex items-center justify-between px-5 py-4">
                            <div>
                                <span className="text-white/90 font-medium">Table {table.table_number}</span>
                                {table.capacity && (
                                    <span className="text-white/30 text-sm ml-2">· {table.capacity} seats</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${table.status === 'available'
                                        ? 'bg-[#2ECC8E]/15 text-[#2ECC8E]'
                                        : table.status === 'occupied'
                                            ? 'bg-amber-500/15 text-amber-400'
                                            : 'bg-white/10 text-white/40'
                                    }`}>
                                    {table.status}
                                </span>
                                <button
                                    onClick={() => handleGenerateQR(table)}
                                    disabled={generatingId === table.id}
                                    className="text-sm text-white/50 hover:text-[#2ECC8E] transition-colors disabled:opacity-50"
                                >
                                    {generatingId === table.id ? 'Generating...' : 'Generate QR'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* QR Modal */}
            {qrDataUrl && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setQrDataUrl(null)}
                >
                    <div
                        className="bg-[#1A1D27] rounded-2xl border border-white/10 p-8 max-w-sm w-full text-center"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-white/90 font-semibold text-lg mb-1">{qrTableLabel}</h3>
                        <p className="text-white/40 text-sm mb-6">Scan to view menu and order</p>
                        <div className="bg-white rounded-xl p-4 inline-block mb-6">
                            <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handlePrintQR}
                                className="flex-1 bg-[#2ECC8E] text-[#0F1117] py-2.5 rounded-lg text-sm font-semibold hover:bg-[#29b87d] transition-colors"
                            >
                                Print
                            </button>
                            <button
                                onClick={() => setQrDataUrl(null)}
                                className="flex-1 bg-white/10 text-white/70 py-2.5 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}