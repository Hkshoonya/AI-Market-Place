-- Migration: Add agentic_browser category
-- Adds a new enum value to model_category for AI-powered browser automation models

ALTER TYPE model_category ADD VALUE IF NOT EXISTS 'agentic_browser';
