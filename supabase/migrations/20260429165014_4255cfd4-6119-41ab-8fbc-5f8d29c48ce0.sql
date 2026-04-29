-- Add new status to homework_status enum for "awaiting mentor reply" cases
ALTER TYPE public.homework_status ADD VALUE IF NOT EXISTS 'awaiting_mentor';