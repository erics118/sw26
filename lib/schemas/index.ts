import { z } from "zod";

// ─── Clients ────────────────────────────────────────────────────────────────

export const ClientSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  name: z.string().min(1),
  company: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  risk_flag: z.boolean().default(false),
  vip: z.boolean().default(false),
});

export const CreateClientSchema = ClientSchema.omit({
  id: true,
  created_at: true,
});
export type CreateClientInput = z.infer<typeof CreateClientSchema>;

// ─── Operators ───────────────────────────────────────────────────────────────

export const OperatorSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  name: z.string().min(1),
  cert_number: z.string().nullable().optional(),
  cert_expiry: z.string().nullable().optional(),
  insurance_expiry: z.string().nullable().optional(),
  reliability_score: z.number().min(0).max(10).default(5.0),
  blacklisted: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export const CreateOperatorSchema = OperatorSchema.omit({
  id: true,
  created_at: true,
});
export type CreateOperatorInput = z.infer<typeof CreateOperatorSchema>;

// ─── Aircraft ────────────────────────────────────────────────────────────────

export const AircraftCategorySchema = z.enum([
  "turboprop",
  "light",
  "midsize",
  "super-mid",
  "heavy",
  "ultra-long",
]);

export const AircraftSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  tail_number: z.string().min(1),
  operator_id: z.string().uuid().nullable().optional(),
  category: AircraftCategorySchema,
  range_nm: z.number().int().positive(),
  cabin_height_in: z.number().nullable().optional(),
  pax_capacity: z.number().int().positive(),
  fuel_burn_gph: z.number().nullable().optional(),
  has_wifi: z.boolean().default(false),
  has_bathroom: z.boolean().default(false),
  home_base_icao: z.string().length(4).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const CreateAircraftSchema = AircraftSchema.omit({
  id: true,
  created_at: true,
});
export type CreateAircraftInput = z.infer<typeof CreateAircraftSchema>;

// ─── Crew ────────────────────────────────────────────────────────────────────

export const CrewRoleSchema = z.enum([
  "captain",
  "first_officer",
  "flight_attendant",
]);

export const CrewSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  operator_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  role: CrewRoleSchema,
  ratings: z.array(z.string()).nullable().optional(),
  duty_hours_this_week: z.number().min(0).default(0),
  last_duty_end: z.string().nullable().optional(),
});

export const CreateCrewSchema = CrewSchema.omit({ id: true, created_at: true });
export type CreateCrewInput = z.infer<typeof CreateCrewSchema>;

// ─── Trips ───────────────────────────────────────────────────────────────────

export const TripLegSchema = z.object({
  from_icao: z.string().min(3).max(4),
  to_icao: z.string().min(3).max(4),
  date: z.string(), // ISO date YYYY-MM-DD
  time: z.string(), // HH:MM
});

export const TripTypeSchema = z.enum(["one_way", "round_trip", "multi_leg"]);

export const TripSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  client_id: z.string().uuid().nullable().optional(),
  raw_input: z.string().nullable().optional(),
  legs: z.array(TripLegSchema).min(1),
  trip_type: TripTypeSchema.default("one_way"),
  pax_adults: z.number().int().min(1).default(1),
  pax_children: z.number().int().min(0).default(0),
  pax_pets: z.number().int().min(0).default(0),
  flexibility_hours: z.number().int().min(0).default(0),
  special_needs: z.string().nullable().optional(),
  catering_notes: z.string().nullable().optional(),
  luggage_notes: z.string().nullable().optional(),
  preferred_category: AircraftCategorySchema.nullable().optional(),
  min_cabin_height_in: z.number().nullable().optional(),
  wifi_required: z.boolean().default(false),
  bathroom_required: z.boolean().default(false),
  ai_extracted: z.boolean().default(false),
  ai_confidence: z.record(z.string(), z.number()).nullable().optional(),
});

export const CreateTripSchema = TripSchema.omit({ id: true, created_at: true });
export type CreateTripInput = z.infer<typeof CreateTripSchema>;

// ─── Quotes ──────────────────────────────────────────────────────────────────

export const QuoteStatusSchema = z.enum([
  "new",
  "pricing",
  "sent",
  "negotiating",
  "confirmed",
  "lost",
  "completed",
]);

export const QuoteSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  trip_id: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  aircraft_id: z.string().uuid().nullable().optional(),
  operator_id: z.string().uuid().nullable().optional(),
  status: QuoteStatusSchema.default("new"),
  version: z.number().int().min(1).default(1),
  margin_pct: z.number().min(0).max(100).default(15),
  currency: z.string().length(3).default("USD"),
  broker_name: z.string().nullable().optional(),
  broker_commission_pct: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  confirmed_at: z.string().nullable().optional(),
});

export const CreateQuoteSchema = QuoteSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;

export const UpdateQuoteSchema = z.object({
  status: QuoteStatusSchema.optional(),
  margin_pct: z.number().min(0).max(100).optional(),
  notes: z.string().nullable().optional(),
  broker_name: z.string().nullable().optional(),
  broker_commission_pct: z.number().nullable().optional(),
});
export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>;

// ─── Quote Costs ─────────────────────────────────────────────────────────────

export const CostLineItemSchema = z.object({
  leg: z.number().int().optional(),
  label: z.string(),
  amount: z.number(),
});

export const QuoteCostSchema = z.object({
  id: z.string().uuid().optional(),
  quote_id: z.string().uuid(),
  fuel_cost: z.number().min(0).default(0),
  fbo_fees: z.number().min(0).default(0),
  repositioning_cost: z.number().min(0).default(0),
  repositioning_hours: z.number().min(0).default(0),
  permit_fees: z.number().min(0).default(0),
  crew_overnight_cost: z.number().min(0).default(0),
  catering_cost: z.number().min(0).default(0),
  peak_day_surcharge: z.number().min(0).default(0),
  subtotal: z.number().min(0).default(0),
  margin_amount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  per_leg_breakdown: z.array(CostLineItemSchema).default([]),
  operator_quoted_rate: z.number().nullable().optional(),
});

export const CreateQuoteCostSchema = QuoteCostSchema.omit({ id: true });
export type CreateQuoteCostInput = z.infer<typeof CreateQuoteCostSchema>;

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const AuditLogSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  user_id: z.string().uuid().nullable().optional(),
  action: z.string().min(1),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  ai_generated: z.boolean().default(false),
  ai_model: z.string().nullable().optional(),
  human_verified: z.boolean().default(false),
});

export const CreateAuditLogSchema = AuditLogSchema.omit({
  id: true,
  created_at: true,
});
export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;

// ─── Intake ───────────────────────────────────────────────────────────────────

export const RequestSourceSchema = z.enum([
  "email",
  "phone",
  "broker",
  "portal",
]);

export const IntakeRequestSchema = z.object({
  raw_text: z.string().min(10),
  client_id: z.string().uuid().optional(),
  request_source: RequestSourceSchema.optional().default("portal"),
});
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;
