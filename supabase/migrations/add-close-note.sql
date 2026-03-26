-- Migration: add close_note column to incidents
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS close_note TEXT;
