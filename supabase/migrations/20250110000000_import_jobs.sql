-- Create import_jobs table for tracking background HR import jobs
-- This table stores job state for async processing with real-time progress updates

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job status and progress
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INTEGER NOT NULL,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  auth_created_count INTEGER DEFAULT 0,

  -- Error tracking (array of error messages)
  errors JSONB DEFAULT '[]'::jsonb,

  -- Import configuration and data
  config JSONB NOT NULL,
  data JSONB NOT NULL, -- Temporary storage of CSV data during processing

  -- Final result summary
  result JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_import_jobs_tenant_id ON import_jobs(tenant_id);
CREATE INDEX idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
CREATE INDEX idx_import_jobs_created_at ON import_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their tenant's import jobs
CREATE POLICY "Users can view their tenant's import jobs"
  ON import_jobs FOR SELECT
  TO authenticated
  USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

-- RLS Policy: Admins can manage their tenant's import jobs
-- Note: Role check is done in API routes, RLS only enforces tenant isolation
CREATE POLICY "Admins can manage their tenant's import jobs"
  ON import_jobs FOR ALL
  TO authenticated
  USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

-- Enable Realtime for this table (for live progress updates)
ALTER PUBLICATION supabase_realtime ADD TABLE import_jobs;

-- Add unique constraint to profiles table to enable UPSERT operations
-- This allows us to use INSERT...ON CONFLICT for efficient batch updates
ALTER TABLE profiles
  ADD CONSTRAINT profiles_tenant_email_unique
  UNIQUE (tenant_id, email);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_import_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Set completed_at when status changes to completed or failed
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    NEW.completed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function
CREATE TRIGGER trigger_update_import_jobs_timestamp
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_import_jobs_updated_at();

-- Add comment for documentation
COMMENT ON TABLE import_jobs IS 'Tracks background HR import jobs with real-time progress updates';
COMMENT ON COLUMN import_jobs.data IS 'Temporary storage of CSV data during processing - should be cleared after completion';
COMMENT ON COLUMN import_jobs.config IS 'HR import configuration (field mapping, required fields, etc.)';
COMMENT ON COLUMN import_jobs.errors IS 'Array of error objects: [{row: number, email: string, message: string}]';
COMMENT ON COLUMN import_jobs.result IS 'Final import summary: {success: number, failed: number, duration: number}';
