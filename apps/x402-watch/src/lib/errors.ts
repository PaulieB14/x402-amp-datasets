import { NextResponse } from "next/server";

export class ApiError extends Error {
  code: string;
  status: number;
  hint?: string;
  constructor(code: string, status: number, message: string, hint?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

export function handle(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, hint: e.hint } },
      { status: e.status },
    );
  }
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json(
    { error: { code: "internal_error", message: msg } },
    { status: 500 },
  );
}
