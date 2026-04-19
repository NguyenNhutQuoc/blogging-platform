/**
 * Catch-all API proxy — forwards /api/* to the backend API server.
 * Handles all HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS).
 */
import type { NextRequest } from "next/server";
import { proxyRequest } from "../../proxy";

export async function GET(request: NextRequest) { return proxyRequest(request); }
export async function POST(request: NextRequest) { return proxyRequest(request); }
export async function PUT(request: NextRequest) { return proxyRequest(request); }
export async function PATCH(request: NextRequest) { return proxyRequest(request); }
export async function DELETE(request: NextRequest) { return proxyRequest(request); }
export async function OPTIONS(request: NextRequest) { return proxyRequest(request); }
