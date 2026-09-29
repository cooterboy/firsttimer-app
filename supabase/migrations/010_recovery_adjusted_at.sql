-- Backs the recovery escalation feature (see lib/sessionEngine.ts's recoverySignal()):
-- timestamp of the first time a "hot" recovery signal triggered a suggested mobility
-- swap / short reschedule. Null means no adjustment currently in effect.

alter table profiles
  add column if not exists recovery_adjusted_at timestamptz;
