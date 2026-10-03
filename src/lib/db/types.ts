export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      dining_tables: {
        Row: {
          capacity: number | null;
          created_at: string;
          id: string;
          is_active: boolean;
          label: string;
          qr_token: string;
          restaurant_id: string;
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label: string;
          qr_token: string;
          restaurant_id: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          qr_token?: string;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dining_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          restaurant_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          restaurant_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          restaurant_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_item_addons: {
        Row: {
          addon_id: string;
          created_at: string;
          item_id: string;
          restaurant_id: string;
        };
        Insert: {
          addon_id: string;
          created_at?: string;
          item_id: string;
          restaurant_id: string;
        };
        Update: {
          addon_id?: string;
          created_at?: string;
          item_id?: string;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_addons_addon_id_restaurant_id_fkey";
            columns: ["addon_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id", "restaurant_id"];
          },
          {
            foreignKeyName: "menu_item_addons_item_id_restaurant_id_fkey";
            columns: ["item_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id", "restaurant_id"];
          },
          {
            foreignKeyName: "menu_item_addons_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          addon_only: boolean;
          category_id: string | null;
          created_at: string;
          description: string | null;
          dietary_tags: string[];
          id: string;
          image_path: string | null;
          is_available: boolean;
          name: string;
          price_cents: number;
          restaurant_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          addon_only?: boolean;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          dietary_tags?: string[];
          id?: string;
          image_path?: string | null;
          is_available?: boolean;
          name: string;
          price_cents: number;
          restaurant_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          addon_only?: boolean;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          dietary_tags?: string[];
          id?: string;
          image_path?: string | null;
          is_available?: boolean;
          name?: string;
          price_cents?: number;
          restaurant_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_restaurant_id_fkey";
            columns: ["category_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id", "restaurant_id"];
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          item_name: string;
          menu_item_id: string | null;
          notes: string | null;
          order_id: string;
          parent_id: string | null;
          quantity: number;
          unit_price_cents: number;
        };
        Insert: {
          id?: string;
          item_name: string;
          menu_item_id?: string | null;
          notes?: string | null;
          order_id: string;
          parent_id?: string | null;
          quantity: number;
          unit_price_cents: number;
        };
        Update: {
          id?: string;
          item_name?: string;
          menu_item_id?: string | null;
          notes?: string | null;
          order_id?: string;
          parent_id?: string | null;
          quantity?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_parent_fk";
            columns: ["parent_id", "order_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id", "order_id"];
          },
        ];
      };
      orders: {
        Row: {
          accepted_at: string | null;
          cancelled_at: string | null;
          editable_until: string;
          id: string;
          notes: string | null;
          placed_by: string | null;
          ready_at: string | null;
          restaurant_id: string;
          served_at: string | null;
          session_id: string;
          status: Database["public"]["Enums"]["order_status"];
          submitted_at: string;
          subtotal_cents: number;
        };
        Insert: {
          accepted_at?: string | null;
          cancelled_at?: string | null;
          editable_until: string;
          id?: string;
          notes?: string | null;
          placed_by?: string | null;
          ready_at?: string | null;
          restaurant_id: string;
          served_at?: string | null;
          session_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          submitted_at?: string;
          subtotal_cents: number;
        };
        Update: {
          accepted_at?: string | null;
          cancelled_at?: string | null;
          editable_until?: string;
          id?: string;
          notes?: string | null;
          placed_by?: string | null;
          ready_at?: string | null;
          restaurant_id?: string;
          served_at?: string | null;
          session_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          submitted_at?: string;
          subtotal_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_session_id_restaurant_id_fkey";
            columns: ["session_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      restaurant_members: {
        Row: {
          created_at: string;
          restaurant_id: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          restaurant_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          restaurant_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_settings: {
        Row: {
          order_addition_cutoff_mins: number;
          order_edit_window_mins: number;
          require_staff_open: boolean;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          order_addition_cutoff_mins?: number;
          order_edit_window_mins?: number;
          require_staff_open?: boolean;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          order_addition_cutoff_mins?: number;
          order_edit_window_mins?: number;
          require_staff_open?: boolean;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: true;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurants: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          name: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          name?: string;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_participants: {
        Row: {
          display_name: string | null;
          joined_at: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          display_name?: string | null;
          joined_at?: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          display_name?: string | null;
          joined_at?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      table_sessions: {
        Row: {
          closed_at: string | null;
          id: string;
          opened_at: string;
          restaurant_id: string;
          status: Database["public"]["Enums"]["session_status"];
          table_id: string;
        };
        Insert: {
          closed_at?: string | null;
          id?: string;
          opened_at?: string;
          restaurant_id: string;
          status?: Database["public"]["Enums"]["session_status"];
          table_id: string;
        };
        Update: {
          closed_at?: string | null;
          id?: string;
          opened_at?: string;
          restaurant_id?: string;
          status?: Database["public"]["Enums"]["session_status"];
          table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_sessions_table_id_restaurant_id_fkey";
            columns: ["table_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "dining_tables";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      close_table_session: { Args: { p_session_id: string }; Returns: undefined };
      create_restaurant: { Args: { p_name: string; p_slug: string }; Returns: string };
      join_table: {
        Args: { p_display_name?: string; p_qr_token: string };
        Returns: {
          restaurant_id: string;
          restaurant_name: string;
          restaurant_slug: string;
          session_id: string;
          table_label: string;
        }[];
      };
      open_table_session: { Args: { p_table_id: string }; Returns: string };
      place_order: {
        Args: { p_items: Json; p_notes?: string; p_session_id: string };
        Returns: string;
      };
      rotate_table_qr: { Args: { p_table_id: string }; Returns: string };
      set_item_availability: {
        Args: { p_available: boolean; p_item_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      member_role: "owner" | "manager" | "staff";
      order_status: "submitted" | "accepted" | "preparing" | "ready" | "served" | "cancelled";
      session_status: "open" | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      member_role: ["owner", "manager", "staff"],
      order_status: ["submitted", "accepted", "preparing", "ready", "served", "cancelled"],
      session_status: ["open", "closed"],
    },
  },
} as const;
