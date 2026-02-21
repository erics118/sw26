import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { calculatePricing } from "@/lib/pricing/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json, TripLeg } from "@/lib/database.types";

type ToolContent = { content: [{ type: "text"; text: string }] };

const ok = (data: unknown): ToolContent => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

const fail = (msg: string): ToolContent => ({
  content: [{ type: "text", text: `Error: ${msg}` }],
});

/**
 * Create all database and computation tools, closed over a Supabase client.
 * Each agent imports only the tools it needs.
 */
export function createDatabaseTools(supabase: SupabaseClient) {
  return [
    // ── Client lookup ─────────────────────────────────────────────────────────

    tool(
      "search_clients",
      "Search for existing clients by name, email, or phone number.",
      {
        name: z.string().optional().describe("Partial client name"),
        email: z.string().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
      },
      async ({ name, email, phone }) => {
        let q = supabase
          .from("clients")
          .select("id, name, email, phone, company")
          .limit(10);
        if (name) q = q.ilike("name", `%${name}%`);
        if (email) q = q.ilike("email", `%${email}%`);
        if (phone) q = q.ilike("phone", `%${phone}%`);
        const { data, error } = await q;
        if (error) return fail(error.message);
        return ok(data ?? []);
      },
    ),

    // ── Trip CRUD ─────────────────────────────────────────────────────────────

    tool(
      "save_trip",
      "Save extracted trip data to the database. Also pass any client contact fields (client_name etc.) so they can be returned as a client_hint without being stored in the trips table.",
      {
        raw_input: z.string().describe("Original raw text"),
        client_id: z.string().nullable().optional(),
        legs: z
          .array(
            z.object({
              from_icao: z.string(),
              to_icao: z.string(),
              date: z.string().describe("ISO YYYY-MM-DD"),
              time: z.string().describe("HH:MM 24h"),
            }),
          )
          .min(1),
        trip_type: z.enum(["one_way", "round_trip", "multi_leg"]),
        pax_adults: z.number().int().min(1),
        pax_children: z.number().int().min(0).default(0),
        pax_pets: z.number().int().min(0).default(0),
        flexibility_hours: z.number().int().min(0).default(0),
        special_needs: z.string().nullable().optional(),
        catering_notes: z.string().nullable().optional(),
        luggage_notes: z.string().nullable().optional(),
        preferred_category: z.string().nullable().optional(),
        min_cabin_height_in: z.number().nullable().optional(),
        wifi_required: z.boolean().default(false),
        bathroom_required: z.boolean().default(false),
        confidence: z
          .record(z.string(), z.number())
          .optional()
          .describe("Per-field confidence scores 0–1"),
        // Contact info returned as client_hint — not persisted to trips table
        client_name: z.string().nullable().optional(),
        client_email: z.string().nullable().optional(),
        client_phone: z.string().nullable().optional(),
        client_company: z.string().nullable().optional(),
      },
      async ({
        confidence,
        client_name,
        client_email,
        client_phone,
        client_company,
        ...tripData
      }) => {
        const { data, error } = await supabase
          .from("trips")
          .insert({
            ...tripData,
            ai_extracted: true,
            ai_confidence: confidence ?? null,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        return ok({
          trip: data,
          client_hint: {
            name: client_name ?? null,
            email: client_email ?? null,
            phone: client_phone ?? null,
            company: client_company ?? null,
          },
        });
      },
    ),

    tool(
      "get_trip",
      "Get full trip details by ID.",
      { trip_id: z.string().uuid() },
      async ({ trip_id }) => {
        const { data, error } = await supabase
          .from("trips")
          .select("*")
          .eq("id", trip_id)
          .single();
        if (error) return fail(error.message);
        return ok(data);
      },
    ),

    // ── Aircraft ──────────────────────────────────────────────────────────────

    tool(
      "list_aircraft",
      "List available aircraft with optional filters for category, range, amenities, and capacity.",
      {
        category: z
          .string()
          .optional()
          .describe(
            "One of: turboprop, light, midsize, super-mid, heavy, ultra-long",
          ),
        min_range_nm: z
          .number()
          .optional()
          .describe("Minimum range in nautical miles"),
        wifi_required: z.boolean().optional(),
        bathroom_required: z.boolean().optional(),
        min_pax: z
          .number()
          .optional()
          .describe("Minimum passenger capacity needed"),
      },
      async ({
        category,
        min_range_nm,
        wifi_required,
        bathroom_required,
        min_pax,
      }) => {
        let q = supabase
          .from("aircraft")
          .select("*")
          .order("range_nm", { ascending: false });
        if (category) q = q.eq("category", category);
        if (min_range_nm) q = q.gte("range_nm", min_range_nm);
        if (wifi_required === true) q = q.eq("has_wifi", true);
        if (bathroom_required === true) q = q.eq("has_bathroom", true);
        if (min_pax) q = q.gte("pax_capacity", min_pax);
        const { data, error } = await q;
        if (error) return fail(error.message);
        return ok(data ?? []);
      },
    ),

    // ── Operators & Crew ──────────────────────────────────────────────────────

    tool(
      "list_operators",
      "List all available charter operators.",
      {
        active_only: z
          .boolean()
          .optional()
          .describe("If true, exclude blacklisted operators"),
      },
      async ({ active_only }) => {
        let q = supabase.from("operators").select("*");
        if (active_only) q = q.eq("blacklisted", false);
        const { data, error } = await q;
        if (error) return fail(error.message);
        return ok(data ?? []);
      },
    ),

    tool(
      "list_crew",
      "List crew members, optionally filtered by operator.",
      { operator_id: z.string().uuid().optional() },
      async ({ operator_id }) => {
        let q = supabase.from("crew").select("*");
        if (operator_id) q = q.eq("operator_id", operator_id);
        const { data, error } = await q;
        if (error) return fail(error.message);
        return ok(data ?? []);
      },
    ),

    // ── Pricing ───────────────────────────────────────────────────────────────

    tool(
      "calculate_pricing",
      "Calculate full pricing for a trip with a specific aircraft. Returns detailed cost breakdown including line_items.",
      {
        legs: z
          .array(
            z.object({
              from_icao: z.string(),
              to_icao: z.string(),
              date: z.string(),
              time: z.string(),
            }),
          )
          .min(1),
        aircraft_category: z
          .string()
          .describe("turboprop, light, midsize, super-mid, heavy, ultra-long"),
        fuel_burn_gph: z
          .number()
          .nullable()
          .optional()
          .describe("Fuel burn in gal/hr. Uses category default if null."),
        home_base_icao: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Aircraft home base ICAO for repositioning cost. Null = no repositioning.",
          ),
        margin_pct: z.number().default(15).describe("Broker margin %"),
        catering_requested: z.boolean().default(false),
        is_international: z
          .boolean()
          .default(false)
          .describe(
            "True if any leg crosses into non-US airspace (ICAO not starting with K)",
          ),
      },
      async (args) => {
        const result = calculatePricing({
          legs: args.legs as TripLeg[],
          aircraftCategory: args.aircraft_category,
          fuelBurnGph: args.fuel_burn_gph ?? null,
          homeBaseIcao: args.home_base_icao ?? null,
          marginPct: args.margin_pct,
          cateringRequested: args.catering_requested,
          isInternational: args.is_international,
        });
        return ok(result);
      },
    ),

    // ── Quote CRUD ────────────────────────────────────────────────────────────

    tool(
      "save_quote",
      "Save a completed quote and its full cost breakdown to the database. Pass all fields from calculate_pricing output. Returns the saved quote, costs, and line_items.",
      {
        trip_id: z.string().uuid(),
        client_id: z.string().uuid().nullable().optional(),
        aircraft_id: z.string().uuid().nullable().optional(),
        operator_id: z.string().uuid().nullable().optional(),
        margin_pct: z.number().default(15),
        currency: z.string().default("USD"),
        notes: z.string().nullable().optional(),
        // ── Cost fields from calculate_pricing output ──
        fuel_cost: z.number(),
        fbo_fees: z.number(),
        repositioning_cost: z.number(),
        repositioning_hours: z.number(),
        permit_fees: z.number(),
        crew_overnight_cost: z.number(),
        catering_cost: z.number(),
        peak_day_surcharge: z.number(),
        subtotal: z.number(),
        margin_amount: z.number(),
        tax: z.number(),
        total: z.number(),
        per_leg_breakdown: z.array(z.any()),
        line_items: z
          .array(z.any())
          .optional()
          .describe("Display line items from calculate_pricing"),
      },
      async (args) => {
        const {
          fuel_cost,
          fbo_fees,
          repositioning_cost,
          repositioning_hours,
          permit_fees,
          crew_overnight_cost,
          catering_cost,
          peak_day_surcharge,
          subtotal,
          margin_amount,
          tax,
          total,
          per_leg_breakdown,
          line_items,
          ...quoteFields
        } = args;

        const { data: quote, error: quoteErr } = await supabase
          .from("quotes")
          .insert({ ...quoteFields, status: "pricing", version: 1 })
          .select()
          .single();
        if (quoteErr || !quote)
          return fail(`Quote insert failed: ${quoteErr?.message}`);

        const { data: costs, error: costsErr } = await supabase
          .from("quote_costs")
          .insert({
            quote_id: quote.id,
            fuel_cost,
            fbo_fees,
            repositioning_cost,
            repositioning_hours,
            permit_fees,
            crew_overnight_cost,
            catering_cost,
            peak_day_surcharge,
            subtotal,
            margin_amount,
            tax,
            total,
            per_leg_breakdown: per_leg_breakdown as unknown as Json,
          })
          .select()
          .single();
        if (costsErr) {
          // Compensating delete — prevent orphaned quote row with no cost data
          await supabase.from("quotes").delete().eq("id", quote.id);
          return fail(`Costs insert failed: ${costsErr.message}`);
        }

        return ok({ quote, costs, line_items: line_items ?? [] });
      },
    ),
  ] as const;
}

export type DatabaseTools = ReturnType<typeof createDatabaseTools>;
