export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      aircraft: {
        Row: {
          cabin_height_in: number | null;
          category: string;
          created_at: string | null;
          cruise_speed_kts: number | null;
          daily_available_hours: number | null;
          etops_certified: boolean | null;
          fuel_burn_gph: number | null;
          has_bathroom: boolean | null;
          has_wifi: boolean | null;
          home_base_icao: string | null;
          id: string;
          max_fuel_capacity_gal: number | null;
          max_payload_lbs: number | null;
          min_runway_ft: number | null;
          notes: string | null;
          pax_capacity: number;
          range_nm: number;
          reserve_fuel_gal: number | null;
          status: string;
          tail_number: string;
        };
        Insert: {
          cabin_height_in?: number | null;
          category: string;
          created_at?: string | null;
          cruise_speed_kts?: number | null;
          daily_available_hours?: number | null;
          etops_certified?: boolean | null;
          fuel_burn_gph?: number | null;
          has_bathroom?: boolean | null;
          has_wifi?: boolean | null;
          home_base_icao?: string | null;
          id?: string;
          max_fuel_capacity_gal?: number | null;
          max_payload_lbs?: number | null;
          min_runway_ft?: number | null;
          notes?: string | null;
          pax_capacity: number;
          range_nm: number;
          reserve_fuel_gal?: number | null;
          status?: string;
          tail_number: string;
        };
        Update: {
          cabin_height_in?: number | null;
          category?: string;
          created_at?: string | null;
          cruise_speed_kts?: number | null;
          daily_available_hours?: number | null;
          etops_certified?: boolean | null;
          fuel_burn_gph?: number | null;
          has_bathroom?: boolean | null;
          has_wifi?: boolean | null;
          home_base_icao?: string | null;
          id?: string;
          max_fuel_capacity_gal?: number | null;
          max_payload_lbs?: number | null;
          min_runway_ft?: number | null;
          notes?: string | null;
          pax_capacity?: number;
          range_nm?: number;
          reserve_fuel_gal?: number | null;
          status?: string;
          tail_number?: string;
        };
        Relationships: [];
      };
      aircraft_maintenance: {
        Row: {
          aircraft_id: string;
          created_at: string | null;
          end_time: string;
          id: string;
          maintenance_type: string;
          notes: string | null;
          start_time: string;
        };
        Insert: {
          aircraft_id: string;
          created_at?: string | null;
          end_time: string;
          id?: string;
          maintenance_type?: string;
          notes?: string | null;
          start_time: string;
        };
        Update: {
          aircraft_id?: string;
          created_at?: string | null;
          end_time?: string;
          id?: string;
          maintenance_type?: string;
          notes?: string | null;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aircraft_maintenance_aircraft_id_fkey";
            columns: ["aircraft_id"];
            isOneToOne: false;
            referencedRelation: "aircraft";
            referencedColumns: ["id"];
          },
        ];
      };
      aircraft_positions: {
        Row: {
          aircraft_id: string;
          altitude_ft: number;
          callsign: string | null;
          client_name: string | null;
          destination_icao: string | null;
          eta: string | null;
          etd: string | null;
          groundspeed_kts: number;
          heading: number;
          id: string;
          in_air: boolean;
          lat: number;
          lon: number;
          origin_icao: string | null;
          pax: number;
          reasons: string[];
          status: string;
          trail: Json;
          updated_at: string;
        };
        Insert: {
          aircraft_id: string;
          altitude_ft?: number;
          callsign?: string | null;
          client_name?: string | null;
          destination_icao?: string | null;
          eta?: string | null;
          etd?: string | null;
          groundspeed_kts?: number;
          heading?: number;
          id?: string;
          in_air?: boolean;
          lat: number;
          lon: number;
          origin_icao?: string | null;
          pax?: number;
          reasons?: string[];
          status?: string;
          trail?: Json;
          updated_at?: string;
        };
        Update: {
          aircraft_id?: string;
          altitude_ft?: number;
          callsign?: string | null;
          client_name?: string | null;
          destination_icao?: string | null;
          eta?: string | null;
          etd?: string | null;
          groundspeed_kts?: number;
          heading?: number;
          id?: string;
          in_air?: boolean;
          lat?: number;
          lon?: number;
          origin_icao?: string | null;
          pax?: number;
          reasons?: string[];
          status?: string;
          trail?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aircraft_positions_aircraft_id_fkey";
            columns: ["aircraft_id"];
            isOneToOne: true;
            referencedRelation: "aircraft";
            referencedColumns: ["id"];
          },
        ];
      };
      airports: {
        Row: {
          city: string | null;
          country_code: string;
          created_at: string;
          curfew_utc: Json | null;
          customs_available: boolean;
          deicing_available: boolean;
          elevation_ft: number | null;
          fbo_fee_usd: number | null;
          fuel_jet_a: boolean;
          fuel_price_updated_at: string | null;
          fuel_price_usd_gal: number | null;
          iata: string | null;
          icao: string;
          lat: number;
          lon: number;
          longest_runway_ft: number | null;
          name: string;
          notes: string | null;
          operating_hours_utc: Json | null;
          slot_required: boolean;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          country_code: string;
          created_at?: string;
          curfew_utc?: Json | null;
          customs_available?: boolean;
          deicing_available?: boolean;
          elevation_ft?: number | null;
          fbo_fee_usd?: number | null;
          fuel_jet_a?: boolean;
          fuel_price_updated_at?: string | null;
          fuel_price_usd_gal?: number | null;
          iata?: string | null;
          icao: string;
          lat: number;
          lon: number;
          longest_runway_ft?: number | null;
          name: string;
          notes?: string | null;
          operating_hours_utc?: Json | null;
          slot_required?: boolean;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          country_code?: string;
          created_at?: string;
          curfew_utc?: Json | null;
          customs_available?: boolean;
          deicing_available?: boolean;
          elevation_ft?: number | null;
          fbo_fee_usd?: number | null;
          fuel_jet_a?: boolean;
          fuel_price_updated_at?: string | null;
          fuel_price_usd_gal?: number | null;
          iata?: string | null;
          icao?: string;
          lat?: number;
          lon?: number;
          longest_runway_ft?: number | null;
          name?: string;
          notes?: string | null;
          operating_hours_utc?: Json | null;
          slot_required?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          ai_generated: boolean | null;
          ai_model: string | null;
          created_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          human_verified: boolean | null;
          id: string;
          payload: Json | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          ai_generated?: boolean | null;
          ai_model?: string | null;
          created_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          human_verified?: boolean | null;
          id?: string;
          payload?: Json | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          ai_generated?: boolean | null;
          ai_model?: string | null;
          created_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          human_verified?: boolean | null;
          id?: string;
          payload?: Json | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          company: string | null;
          created_at: string | null;
          email: string | null;
          id: string;
          name: string;
          nationality: string | null;
          notes: string | null;
          phone: string | null;
          risk_flag: boolean | null;
          vip: boolean | null;
        };
        Insert: {
          company?: string | null;
          created_at?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          nationality?: string | null;
          notes?: string | null;
          phone?: string | null;
          risk_flag?: boolean | null;
          vip?: boolean | null;
        };
        Update: {
          company?: string | null;
          created_at?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          nationality?: string | null;
          notes?: string | null;
          phone?: string | null;
          risk_flag?: boolean | null;
          vip?: boolean | null;
        };
        Relationships: [];
      };
      crew: {
        Row: {
          available_hours_per_day: number | null;
          created_at: string | null;
          current_location: string | null;
          duty_hours_this_week: number | null;
          id: string;
          last_duty_end: string | null;
          name: string;
          ratings: string[] | null;
          role: string;
        };
        Insert: {
          available_hours_per_day?: number | null;
          created_at?: string | null;
          current_location?: string | null;
          duty_hours_this_week?: number | null;
          id?: string;
          last_duty_end?: string | null;
          name: string;
          ratings?: string[] | null;
          role: string;
        };
        Update: {
          available_hours_per_day?: number | null;
          created_at?: string | null;
          current_location?: string | null;
          duty_hours_this_week?: number | null;
          id?: string;
          last_duty_end?: string | null;
          name?: string;
          ratings?: string[] | null;
          role?: string;
        };
        Relationships: [];
      };
      empty_leg_offers: {
        Row: {
          aircraft_id: string;
          created_at: string | null;
          discount_pct: number;
          from_icao: string;
          id: string;
          offer_date: string;
          reason: string;
          status: string;
          to_icao: string;
        };
        Insert: {
          aircraft_id: string;
          created_at?: string | null;
          discount_pct?: number;
          from_icao: string;
          id?: string;
          offer_date: string;
          reason?: string;
          status?: string;
          to_icao: string;
        };
        Update: {
          aircraft_id?: string;
          created_at?: string | null;
          discount_pct?: number;
          from_icao?: string;
          id?: string;
          offer_date?: string;
          reason?: string;
          status?: string;
          to_icao?: string;
        };
        Relationships: [];
      };
      fleet_forecast_overrides: {
        Row: {
          aircraft_category: string;
          created_at: string | null;
          date: string;
          id: string;
          peak_multiplier: number;
          reason: string | null;
        };
        Insert: {
          aircraft_category: string;
          created_at?: string | null;
          date: string;
          id?: string;
          peak_multiplier?: number;
          reason?: string | null;
        };
        Update: {
          aircraft_category?: string;
          created_at?: string | null;
          date?: string;
          id?: string;
          peak_multiplier?: number;
          reason?: string | null;
        };
        Relationships: [];
      };
      forecast_signals: {
        Row: {
          aircraft_category: string | null;
          confidence: string;
          created_at: string;
          date_range_end: string;
          date_range_start: string;
          id: string;
          model_version: string;
          payload: Json;
          reason_codes: string[];
          signal_type: string;
        };
        Insert: {
          aircraft_category?: string | null;
          confidence?: string;
          created_at?: string;
          date_range_end: string;
          date_range_start: string;
          id?: string;
          model_version?: string;
          payload?: Json;
          reason_codes?: string[];
          signal_type: string;
        };
        Update: {
          aircraft_category?: string | null;
          confidence?: string;
          created_at?: string;
          date_range_end?: string;
          date_range_start?: string;
          id?: string;
          model_version?: string;
          payload?: Json;
          reason_codes?: string[];
          signal_type?: string;
        };
        Relationships: [];
      };
      quote_costs: {
        Row: {
          catering_cost: number | null;
          crew_overnight_cost: number | null;
          fbo_fees: number | null;
          fuel_cost: number | null;
          id: string;
          margin_amount: number | null;
          peak_day_surcharge: number | null;
          per_leg_breakdown: Json | null;
          permit_fees: number | null;
          quote_id: string;
          repositioning_cost: number | null;
          repositioning_hours: number | null;
          subtotal: number | null;
          tax: number | null;
          total: number | null;
        };
        Insert: {
          catering_cost?: number | null;
          crew_overnight_cost?: number | null;
          fbo_fees?: number | null;
          fuel_cost?: number | null;
          id?: string;
          margin_amount?: number | null;
          peak_day_surcharge?: number | null;
          per_leg_breakdown?: Json | null;
          permit_fees?: number | null;
          quote_id: string;
          repositioning_cost?: number | null;
          repositioning_hours?: number | null;
          subtotal?: number | null;
          tax?: number | null;
          total?: number | null;
        };
        Update: {
          catering_cost?: number | null;
          crew_overnight_cost?: number | null;
          fbo_fees?: number | null;
          fuel_cost?: number | null;
          id?: string;
          margin_amount?: number | null;
          peak_day_surcharge?: number | null;
          per_leg_breakdown?: Json | null;
          permit_fees?: number | null;
          quote_id?: string;
          repositioning_cost?: number | null;
          repositioning_hours?: number | null;
          subtotal?: number | null;
          tax?: number | null;
          total?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quote_costs_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          actual_arrival_time: string | null;
          actual_block_hours: number | null;
          actual_departure_time: string | null;
          actual_reposition_hours: number | null;
          actual_total_hours: number | null;
          aircraft_id: string | null;
          broker_commission_pct: number | null;
          broker_name: string | null;
          chosen_aircraft_category: string | null;
          client_id: string | null;
          confirmed_at: string | null;
          created_at: string | null;
          currency: string | null;
          delay_reason_code: string | null;
          estimated_total_hours: number | null;
          id: string;
          margin_pct: number | null;
          notes: string | null;
          quote_valid_until: string | null;
          scheduled_arrival_time: string | null;
          scheduled_departure_time: string | null;
          scheduled_total_hours: number | null;
          sent_at: string | null;
          status: string;
          trip_id: string;
          updated_at: string | null;
          version: number | null;
          won_lost_reason: string | null;
        };
        Insert: {
          actual_arrival_time?: string | null;
          actual_block_hours?: number | null;
          actual_departure_time?: string | null;
          actual_reposition_hours?: number | null;
          actual_total_hours?: number | null;
          aircraft_id?: string | null;
          broker_commission_pct?: number | null;
          broker_name?: string | null;
          chosen_aircraft_category?: string | null;
          client_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          currency?: string | null;
          delay_reason_code?: string | null;
          estimated_total_hours?: number | null;
          id?: string;
          margin_pct?: number | null;
          notes?: string | null;
          quote_valid_until?: string | null;
          scheduled_arrival_time?: string | null;
          scheduled_departure_time?: string | null;
          scheduled_total_hours?: number | null;
          sent_at?: string | null;
          status?: string;
          trip_id: string;
          updated_at?: string | null;
          version?: number | null;
          won_lost_reason?: string | null;
        };
        Update: {
          actual_arrival_time?: string | null;
          actual_block_hours?: number | null;
          actual_departure_time?: string | null;
          actual_reposition_hours?: number | null;
          actual_total_hours?: number | null;
          aircraft_id?: string | null;
          broker_commission_pct?: number | null;
          broker_name?: string | null;
          chosen_aircraft_category?: string | null;
          client_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          currency?: string | null;
          delay_reason_code?: string | null;
          estimated_total_hours?: number | null;
          id?: string;
          margin_pct?: number | null;
          notes?: string | null;
          quote_valid_until?: string | null;
          scheduled_arrival_time?: string | null;
          scheduled_departure_time?: string | null;
          scheduled_total_hours?: number | null;
          sent_at?: string | null;
          status?: string;
          trip_id?: string;
          updated_at?: string | null;
          version?: number | null;
          won_lost_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_aircraft_id_fkey";
            columns: ["aircraft_id"];
            isOneToOne: false;
            referencedRelation: "aircraft";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendation_outcomes: {
        Row: {
          accepted_at: string | null;
          aircraft_id: string | null;
          executed_at: string | null;
          id: string;
          outcome_status: string;
          payload: Json;
          realized_hours_gained: number | null;
          realized_revenue_delta: number | null;
          recommendation_type: string;
          recommended_at: string;
          tail_number: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          aircraft_id?: string | null;
          executed_at?: string | null;
          id?: string;
          outcome_status?: string;
          payload?: Json;
          realized_hours_gained?: number | null;
          realized_revenue_delta?: number | null;
          recommendation_type: string;
          recommended_at?: string;
          tail_number?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          aircraft_id?: string | null;
          executed_at?: string | null;
          id?: string;
          outcome_status?: string;
          payload?: Json;
          realized_hours_gained?: number | null;
          realized_revenue_delta?: number | null;
          recommendation_type?: string;
          recommended_at?: string;
          tail_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_outcomes_aircraft_id_fkey";
            columns: ["aircraft_id"];
            isOneToOne: false;
            referencedRelation: "aircraft";
            referencedColumns: ["id"];
          },
        ];
      };
      route_plans: {
        Row: {
          aircraft_id: string | null;
          alternatives: Json;
          computed_at: string;
          cost_breakdown: Json | null;
          created_at: string;
          id: string;
          is_stale: boolean;
          notam_alerts: Json;
          notam_fetched_at: string | null;
          on_time_probability: number | null;
          optimization_mode: string;
          quote_id: string | null;
          refuel_stops: Json;
          risk_score: number | null;
          route_legs: Json;
          total_distance_nm: number | null;
          total_flight_time_hr: number | null;
          total_fuel_cost: number | null;
          trip_id: string | null;
          weather_fetched_at: string | null;
          weather_summary: Json;
        };
        Insert: {
          aircraft_id?: string | null;
          alternatives?: Json;
          computed_at?: string;
          cost_breakdown?: Json | null;
          created_at?: string;
          id?: string;
          is_stale?: boolean;
          notam_alerts?: Json;
          notam_fetched_at?: string | null;
          on_time_probability?: number | null;
          optimization_mode?: string;
          quote_id?: string | null;
          refuel_stops?: Json;
          risk_score?: number | null;
          route_legs?: Json;
          total_distance_nm?: number | null;
          total_flight_time_hr?: number | null;
          total_fuel_cost?: number | null;
          trip_id?: string | null;
          weather_fetched_at?: string | null;
          weather_summary?: Json;
        };
        Update: {
          aircraft_id?: string | null;
          alternatives?: Json;
          computed_at?: string;
          cost_breakdown?: Json | null;
          created_at?: string;
          id?: string;
          is_stale?: boolean;
          notam_alerts?: Json;
          notam_fetched_at?: string | null;
          on_time_probability?: number | null;
          optimization_mode?: string;
          quote_id?: string | null;
          refuel_stops?: Json;
          risk_score?: number | null;
          route_legs?: Json;
          total_distance_nm?: number | null;
          total_flight_time_hr?: number | null;
          total_fuel_cost?: number | null;
          trip_id?: string | null;
          weather_fetched_at?: string | null;
          weather_summary?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "route_plans_aircraft_id_fkey";
            columns: ["aircraft_id"];
            isOneToOne: false;
            referencedRelation: "aircraft";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "route_plans_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "route_plans_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          ai_confidence: Json | null;
          ai_extracted: boolean | null;
          bathroom_required: boolean | null;
          catering_notes: string | null;
          client_id: string | null;
          created_at: string | null;
          estimated_block_hours: number | null;
          estimated_reposition_hours: number | null;
          estimated_total_hours: number | null;
          flexibility_hours: number | null;
          flexibility_hours_return: number | null;
          id: string;
          legs: Json;
          luggage_notes: string | null;
          min_cabin_height_in: number | null;
          pax_adults: number | null;
          pax_children: number | null;
          pax_pets: number | null;
          preferred_category: string | null;
          raw_input: string | null;
          request_source: string | null;
          requested_departure_window_end: string | null;
          requested_departure_window_start: string | null;
          requested_return_window_end: string | null;
          requested_return_window_start: string | null;
          special_needs: string | null;
          trip_type: string;
          wifi_required: boolean | null;
        };
        Insert: {
          ai_confidence?: Json | null;
          ai_extracted?: boolean | null;
          bathroom_required?: boolean | null;
          catering_notes?: string | null;
          client_id?: string | null;
          created_at?: string | null;
          estimated_block_hours?: number | null;
          estimated_reposition_hours?: number | null;
          estimated_total_hours?: number | null;
          flexibility_hours?: number | null;
          flexibility_hours_return?: number | null;
          id?: string;
          legs?: Json;
          luggage_notes?: string | null;
          min_cabin_height_in?: number | null;
          pax_adults?: number | null;
          pax_children?: number | null;
          pax_pets?: number | null;
          preferred_category?: string | null;
          raw_input?: string | null;
          request_source?: string | null;
          requested_departure_window_end?: string | null;
          requested_departure_window_start?: string | null;
          requested_return_window_end?: string | null;
          requested_return_window_start?: string | null;
          special_needs?: string | null;
          trip_type?: string;
          wifi_required?: boolean | null;
        };
        Update: {
          ai_confidence?: Json | null;
          ai_extracted?: boolean | null;
          bathroom_required?: boolean | null;
          catering_notes?: string | null;
          client_id?: string | null;
          created_at?: string | null;
          estimated_block_hours?: number | null;
          estimated_reposition_hours?: number | null;
          estimated_total_hours?: number | null;
          flexibility_hours?: number | null;
          flexibility_hours_return?: number | null;
          id?: string;
          legs?: Json;
          luggage_notes?: string | null;
          min_cabin_height_in?: number | null;
          pax_adults?: number | null;
          pax_children?: number | null;
          pax_pets?: number | null;
          preferred_category?: string | null;
          raw_input?: string | null;
          request_source?: string | null;
          requested_departure_window_end?: string | null;
          requested_departure_window_start?: string | null;
          requested_return_window_end?: string | null;
          requested_return_window_start?: string | null;
          special_needs?: string | null;
          trip_type?: string;
          wifi_required?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "trips_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

// Convenience row types for app code
export type Client = Tables<"clients">;
export type Aircraft = Tables<"aircraft">;
export type AircraftPosition = Tables<"aircraft_positions">;
export type Crew = Tables<"crew">;
export type Trip = Tables<"trips">;
export type Quote = Tables<"quotes">;
export type QuoteCost = Tables<"quote_costs">;
export type AuditLog = Tables<"audit_logs">;
export type AircraftMaintenance = Tables<"aircraft_maintenance">;
export type FleetForecastOverride = Tables<"fleet_forecast_overrides">;
export type ForecastSignal = Tables<"forecast_signals">;
export type RecommendationOutcome = Tables<"recommendation_outcomes">;
export type RoutePlan = Tables<"route_plans">;

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
