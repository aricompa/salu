export type Restaurant = {
    id: string
    name: string
    slug: string
    owner_user_id: string
    order_edit_window_mins: number
    order_addition_cutoff_mins: number
    auto_confirm_reservations: boolean
    auto_charge_grace_period_mins: number
    created_at: string
}

export type Table = {
    id: string
    restaurant_id: string
    table_number: string
    capacity: number | null
    status: 'available' | 'occupied' | 'reserved'
    created_at: string
}

export type Session = {
    id: string
    restaurant_id: string
    table_id: string
    status: 'open' | 'checked_in' | 'closed'
    opened_at: string
    checked_in_at: string | null
    closed_at: string | null
}

export type MenuCategory = {
    id: string
    restaurant_id: string
    name: string
    sort_order: number
    created_at: string
}

export type MenuItem = {
    id: string
    restaurant_id: string
    category_id: string | null
    name: string
    description: string | null
    price_cents: number
    available: boolean
    image_url: string | null
    created_at: string
}

export type Order = {
    id: string
    session_id: string
    diner_identifier: string
    status: 'pending' | 'confirmed' | 'in_progress' | 'ready' | 'completed' | 'cancelled'
    submitted_at: string
    locked_at: string | null
}

export type OrderItem = {
    id: string
    order_id: string
    menu_item_id: string | null
    quantity: number
    unit_price_cents: number
    notes: string | null
}