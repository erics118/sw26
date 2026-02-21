export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          company: string | null;
          email: string | null;
          phone: string | null;
          nationality: string | null;
          notes: string | null;
          risk_flag: boolean;
          vip: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          nationality?: string | null;
          notes?: string | null;
          risk_flag?: boolean;
          vip?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      operators: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          cert_number: string | null;
          cert_expiry: string | null;
          insurance_expiry: string | null;
          reliability_score: number;
          blacklisted: boolean;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          cert_number?: string | null;
          cert_expiry?: string | null;
          insurance_expiry?: string | null;
          reliability_score?: number;
          blacklisted?: boolean;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["operators"]["Insert"]>;
        Relationships: [];
      };
      aircraft: {
        Row: {
          id: string;
          created_at: string;
          tail_number: string;
          operator_id: string | null;
          category: string;
          range_nm: number;
          cabin_height_in: number | null;
          pax_capacity: number;
          fuel_burn_gph: number | null;
          has_wifi: boolean;
          has_bathroom: boolean;
          home_base_icao: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          tail_number: string;
          operator_id?: string | null;
          category: string;
          range_nm: number;
          cabin_height_in?: number | null;
          pax_capacity: number;
          fuel_burn_gph?: number | null;
          has_wifi?: boolean;
          has_bathroom?: boolean;
          home_base_icao?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["aircraft"]["Insert"]>;
        Relationships: [];
      };
      crew: {
        Row: {
          id: string;
          created_at: string;
          operator_id: string | null;
          name: string;
          role: string;
          ratings: string[] | null;
          duty_hours_this_week: number;
          last_duty_end: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          operator_id?: string | null;
          name: string;
          role: string;
          ratings?: string[] | null;
          duty_hours_this_week?: number;
          last_duty_end?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["crew"]["Insert"]>;
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          created_at: string;
          client_id: string | null;
          raw_input: string | null;
          legs: Json;
          trip_type: string;
          pax_adults: number;
          pax_children: number;
          pax_pets: number;
          flexibility_hours: number;
          special_needs: string | null;
          catering_notes: string | null;
          luggage_notes: string | null;
          preferred_category: string | null;
          min_cabin_height_in: number | null;
          wifi_required: boolean;
          bathroom_required: boolean;
          ai_extracted: boolean;
          ai_confidence: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          client_id?: string | null;
          raw_input?: string | null;
          legs?: Json;
          trip_type?: string;
          pax_adults?: number;
          pax_children?: number;
          pax_pets?: number;
          flexibility_hours?: number;
          special_needs?: string | null;
          catering_notes?: string | null;
          luggage_notes?: string | null;
          preferred_category?: string | null;
          min_cabin_height_in?: number | null;
          wifi_required?: boolean;
          bathroom_required?: boolean;
          ai_extracted?: boolean;
          ai_confidence?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          trip_id: string;
          client_id: string | null;
          aircraft_id: string | null;
          operator_id: string | null;
          status: string;
          version: number;
          margin_pct: number;
          currency: string;
          broker_name: string | null;
          broker_commission_pct: number | null;
          notes: string | null;
          sent_at: string | null;
          confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          trip_id: string;
          client_id?: string | null;
          aircraft_id?: string | null;
          operator_id?: string | null;
          status?: string;
          version?: number;
          margin_pct?: number;
          currency?: string;
          broker_name?: string | null;
          broker_commission_pct?: number | null;
          notes?: string | null;
          sent_at?: string | null;
          confirmed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [];
      };
      quote_costs: {
        Row: {
          id: string;
          quote_id: string;
          fuel_cost: number;
          fbo_fees: number;
          repositioning_cost: number;
          repositioning_hours: number;
          permit_fees: number;
          crew_overnight_cost: number;
          catering_cost: number;
          peak_day_surcharge: number;
          subtotal: number;
          margin_amount: number;
          tax: number;
          total: number;
          per_leg_breakdown: Json;
          operator_quoted_rate: number | null;
        };
        Insert: {
          id?: string;
          quote_id: string;
          fuel_cost?: number;
          fbo_fees?: number;
          repositioning_cost?: number;
          repositioning_hours?: number;
          permit_fees?: number;
          crew_overnight_cost?: number;
          catering_cost?: number;
          peak_day_surcharge?: number;
          subtotal?: number;
          margin_amount?: number;
          tax?: number;
          total?: number;
          per_leg_breakdown?: Json;
          operator_quoted_rate?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["quote_costs"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          created_at: string;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          payload: Json | null;
          ai_generated: boolean;
          ai_model: string | null;
          human_verified: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          payload?: Json | null;
          ai_generated?: boolean;
          ai_model?: string | null;
          human_verified?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Operator = Database["public"]["Tables"]["operators"]["Row"];
export type Aircraft = Database["public"]["Tables"]["aircraft"]["Row"];
export type Crew = Database["public"]["Tables"]["crew"]["Row"];
export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type Quote = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteCost = Database["public"]["Tables"]["quote_costs"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type TripLeg = {
  from_icao: string;
  to_icao: string;
  date: string;
  time: string;
};

export type QuoteStatus =
  | "new"
  | "pricing"
  | "sent"
  | "negotiating"
  | "confirmed"
  | "lost"
  | "completed";
