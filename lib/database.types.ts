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
          // Added by migration 001_aircraft_performance
          cruise_speed_kts: number | null;
          max_fuel_capacity_gal: number | null;
          min_runway_ft: number | null;
          etops_certified: boolean;
          max_payload_lbs: number | null;
          reserve_fuel_gal: number | null;
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
          cruise_speed_kts?: number | null;
          max_fuel_capacity_gal?: number | null;
          min_runway_ft?: number | null;
          etops_certified?: boolean;
          max_payload_lbs?: number | null;
          reserve_fuel_gal?: number | null;
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
      airports: {
        Row: {
          icao: string;
          iata: string | null;
          name: string;
          city: string | null;
          country_code: string;
          lat: number;
          lon: number;
          elevation_ft: number | null;
          longest_runway_ft: number | null;
          fuel_jet_a: boolean;
          fuel_price_usd_gal: number | null;
          fuel_price_updated_at: string | null;
          fbo_fee_usd: number | null;
          operating_hours_utc: Json | null;
          curfew_utc: Json | null;
          customs_available: boolean;
          deicing_available: boolean;
          slot_required: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          icao: string;
          iata?: string | null;
          name: string;
          city?: string | null;
          country_code: string;
          lat: number;
          lon: number;
          elevation_ft?: number | null;
          longest_runway_ft?: number | null;
          fuel_jet_a?: boolean;
          fuel_price_usd_gal?: number | null;
          fuel_price_updated_at?: string | null;
          fbo_fee_usd?: number | null;
          operating_hours_utc?: Json | null;
          curfew_utc?: Json | null;
          customs_available?: boolean;
          deicing_available?: boolean;
          slot_required?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["airports"]["Insert"]>;
        Relationships: [];
      };
      route_plans: {
        Row: {
          id: string;
          created_at: string;
          quote_id: string | null;
          trip_id: string | null;
          aircraft_id: string | null;
          optimization_mode: string;
          route_legs: Json;
          refuel_stops: Json;
          weather_summary: Json;
          notam_alerts: Json;
          alternatives: Json;
          cost_breakdown: Json | null;
          total_distance_nm: number | null;
          total_flight_time_hr: number | null;
          total_fuel_cost: number | null;
          risk_score: number | null;
          on_time_probability: number | null;
          computed_at: string;
          weather_fetched_at: string | null;
          notam_fetched_at: string | null;
          is_stale: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          quote_id?: string | null;
          trip_id?: string | null;
          aircraft_id?: string | null;
          optimization_mode: string;
          route_legs: Json;
          refuel_stops: Json;
          weather_summary: Json;
          notam_alerts: Json;
          alternatives: Json;
          cost_breakdown?: Json | null;
          total_distance_nm?: number | null;
          total_flight_time_hr?: number | null;
          total_fuel_cost?: number | null;
          risk_score?: number | null;
          on_time_probability?: number | null;
          computed_at?: string;
          weather_fetched_at?: string | null;
          notam_fetched_at?: string | null;
          is_stale?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["route_plans"]["Insert"]>;
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

// ─── Airport ──────────────────────────────────────────────────────────────────
export type Airport = {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country_code: string;
  lat: number;
  lon: number;
  elevation_ft: number | null;
  longest_runway_ft: number | null;
  fuel_jet_a: boolean;
  fuel_price_usd_gal: number | null;
  fuel_price_updated_at: string | null;
  fbo_fee_usd: number | null;
  operating_hours_utc: { from: string; to: string } | null;
  curfew_utc: { from: string; to: string } | null;
  customs_available: boolean;
  deicing_available: boolean;
  slot_required: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ─── RoutePlan ────────────────────────────────────────────────────────────────
export type RoutePlan = {
  id: string;
  created_at: string;
  quote_id: string | null;
  trip_id: string | null;
  aircraft_id: string | null;
  optimization_mode: string;
  route_legs: Json;
  refuel_stops: Json;
  weather_summary: Json;
  notam_alerts: Json;
  alternatives: Json;
  cost_breakdown: Json | null;
  total_distance_nm: number | null;
  total_flight_time_hr: number | null;
  total_fuel_cost: number | null;
  risk_score: number | null;
  on_time_probability: number | null;
  computed_at: string;
  weather_fetched_at: string | null;
  notam_fetched_at: string | null;
  is_stale: boolean;
};
