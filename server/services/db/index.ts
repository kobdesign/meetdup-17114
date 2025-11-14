/**
 * Centralized Database Service Layer
 * 
 * This service bypasses Supabase PostgREST to avoid schema cache issues.
 * All database operations go through direct PostgreSQL connections.
 * 
 * RLS (Row Level Security) is enforced through auth helpers in code.
 */

export * from './pool';
export * from './types';
export * from './auth';
export { TenantService } from './tenants';
export { ParticipantService } from './participants';
