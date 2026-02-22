import { NextResponse } from "next/server";
import { mockFlights } from "@/lib/ops/mockData";

export async function GET() {
  return NextResponse.json({ flights: mockFlights });
}
