import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { calculatePricing } from "@/lib/pricing/engine";
import { computeRoutePlan, RoutingError } from "@/lib/routing";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json, TripLeg } from "@/lib/database.types";
import {
  TripLegSchema,
  TripTypeSchema,
  OptimizationModeSchema,
} from "@/lib/schemas";

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
        legs: z.array(TripLegSchema).min(1),
        trip_type: TripTypeSchema,
        pax_adults: z.number().int().min(1),
        pax_children: z.number().int().min(0).default(0),
        pax_pets: z.number().int().min(0).default(0),
        flexibility_hours: z.number().int().min(0).default(0),
        flexibility_hours_return: z.number().int().min(0).default(0),
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

    tool(
      "lookup_airport",
      "Look up airport ICAO code by city name, airport name, or partial match. Fast DB lookup — use instead of WebFetch for airport resolution.",
      {
        query: z
          .string()
          .describe(
            "City name, airport name, or partial text (e.g. 'Los Angeles', 'Teterboro', 'JFK')",
          ),
      },
      async ({ query }) => {
        const q = query.trim().replace(/'/g, "''");
        if (!q) return ok([]);
        const { data, error } = await supabase
          .from("airports")
          .select("icao, iata, name, city, country_code")
          .or(
            `city.ilike.%${q}%,name.ilike.%${q}%,icao.ilike.%${q}%,iata.ilike.%${q}%`,
          )
          .limit(5);
        if (error) return fail(error.message);
        return ok(data ?? []);
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
          .eq("status", "active")
          .order("range_nm", { ascending: false });
        if (category) q = q.eq("category", category);
        if (min_range_nm) q = q.gte("range_nm", min_range_nm);
        if (wifi_required === true) q = q.eq("has_wifi", true);
        if (bathroom_required === true) q = q.eq("has_bathroom", true);
        if (min_pax) q = q.gte("pax_capacity", min_pax);
        const { data, error } = await q.limit(5);
        if (error) return fail(error.message);
        return ok(data ?? []);
      },
    ),

    // ── Crew ──────────────────────────────────────────────────────────────────

    tool("list_crew", "List all crew members.", {}, async () => {
      const { data, error } = await supabase.from("crew").select("*");
      if (error) return fail(error.message);
      return ok(data ?? []);
    }),

    // ── Routing ───────────────────────────────────────────────────────────────

    tool(
      "compute_route_plan",
      "Compute a full route plan for an aircraft and trip legs. Returns optimized route (including fuel stops), weather summaries, NOTAM alerts, risk score, on-time probability, and cost breakdown. Use cost_breakdown.avg_fuel_price_usd_gal as fuel_price_override_usd when calling calculate_pricing. Pass skip_weather_notam: true for faster runs when building quotes (no live weather/NOTAM fetch).",
      {
        aircraft_id: z.string().uuid(),
        legs: z.array(TripLegSchema).min(1),
        optimization_mode: OptimizationModeSchema.default("balanced").describe(
          "Route optimization preference: cost = minimize fuel cost; time = minimize flight time; balanced = trade-off",
        ),
        skip_weather_notam: z
          .boolean()
          .optional()
          .describe(
            "If true, skip weather/NOTAM API calls for speed (use when building quotes)",
          ),
      },
      async ({
        aircraft_id,
        legs,
        optimization_mode,
        skip_weather_notam = false,
      }) => {
        try {
          const result = await computeRoutePlan({
            aircraft_id,
            legs,
            optimization_mode,
            skip_weather_notam,
          });
          return ok(result);
        } catch (err) {
          if (err instanceof RoutingError) {
            return fail(`${err.code}: ${err.message}`);
          }
          return fail(err instanceof Error ? err.message : "Routing failed");
        }
      },
    ),

    tool(
      "save_route_plan",
      "Persist a route plan to the database, linked to a quote. Call after save_quote when you have a quote_id. Pass the full result from compute_route_plan.",
      {
        quote_id: z.string().uuid(),
        trip_id: z.string().uuid().nullable().optional(),
        aircraft_id: z.string().uuid(),
        optimization_mode: OptimizationModeSchema,
        route_legs: z.array(z.any()),
        refuel_stops: z.array(z.any()),
        weather_summary: z.array(z.any()),
        notam_alerts: z.array(z.any()),
        alternatives: z.array(z.any()),
        cost_breakdown: z.record(z.string(), z.any()),
        total_distance_nm: z.number(),
        total_flight_time_hr: z.number(),
        total_fuel_cost_usd: z.number(),
        risk_score: z.number(),
        on_time_probability: z.number(),
      },
      async (args) => {
        const {
          route_legs,
          refuel_stops,
          weather_summary,
          notam_alerts,
          alternatives,
          cost_breakdown,
          total_distance_nm,
          total_flight_time_hr,
          total_fuel_cost_usd,
          risk_score,
          on_time_probability,
          ...rest
        } = args;
        const { data: plan, error } = await supabase
          .from("route_plans")
          .insert({
            ...rest,
            route_legs: route_legs as unknown as Json,
            refuel_stops: refuel_stops as unknown as Json,
            weather_summary: weather_summary as unknown as Json,
            notam_alerts: notam_alerts as unknown as Json,
            alternatives: alternatives as unknown as Json,
            cost_breakdown: cost_breakdown as unknown as Json,
            total_distance_nm,
            total_flight_time_hr,
            total_fuel_cost: total_fuel_cost_usd,
            risk_score,
            on_time_probability,
            weather_fetched_at: new Date().toISOString(),
            notam_fetched_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) return fail(error.message);
        await supabase.from("audit_logs").insert({
          action: "route_plan.computed",
          entity_type: "route_plans",
          entity_id: plan?.id ?? null,
          ai_generated: true,
          payload: {
            aircraft_id: args.aircraft_id,
            leg_count: route_legs.length,
            stop_count: refuel_stops.length,
            risk_score,
            optimization_mode: args.optimization_mode,
          },
        });
        return ok({ plan_id: plan?.id });
      },
    ),

    // ── Pricing ───────────────────────────────────────────────────────────────

    tool(
      "calculate_pricing",
      "Calculate full pricing for a trip with a specific aircraft. Returns detailed cost breakdown including line_items.",
      {
        legs: z.array(TripLegSchema).min(1),
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
        margin_pct: z
          .number()
          .default(15)
          .describe("Margin % on cost breakdown"),
        catering_requested: z.boolean().default(false),
        is_international: z
          .boolean()
          .default(false)
          .describe(
            "True if any leg crosses into non-US airspace (ICAO not starting with K)",
          ),
        fuel_price_override_usd: z
          .number()
          .positive()
          .optional()
          .describe(
            "Override default fuel price in USD per gallon. If omitted, engine uses default.",
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
          fuelPriceOverrideUsd: args.fuel_price_override_usd,
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
