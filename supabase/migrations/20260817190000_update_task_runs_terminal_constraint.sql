-- Migration: 20260817190000_update_task_runs_terminal_constraint.sql
-- Update task_runs_terminal_timestamps_check constraint to enforce that terminal runs
-- ('completed', 'failed') have non-null completed_at >= created_at (and >= started_at if started),
-- while active runs ('queued', 'running', 'retrying') omit completed_at (completed_at IS NULL).

ALTER TABLE public.task_runs DROP CONSTRAINT IF EXISTS task_runs_terminal_timestamps_check;
ALTER TABLE public.task_runs ADD CONSTRAINT task_runs_terminal_timestamps_check CHECK (
  (status IN ('completed', 'failed') AND completed_at IS NOT NULL AND completed_at >= created_at AND (started_at IS NULL OR completed_at >= started_at))
  OR
  (status IN ('queued', 'running', 'retrying') AND completed_at IS NULL)
);
