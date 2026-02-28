-- Allocation Audit Table
-- Tracks every allocation decision for compliance and traceability

CREATE TABLE IF NOT EXISTS shift_allocation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  roster_pattern_id uuid NOT NULL REFERENCES roster_patterns(id) ON DELETE CASCADE,
  
  -- Allocation metadata
  allocation_mode VARCHAR(50) NOT NULL,
  allocation_date DATE,
  allocation_dates DATE[] DEFAULT NULL, -- For SPLIT_BY_DAY mode
  
  -- Configuration snapshot (for auditability)
  allocation_params_snapshot JSONB NOT NULL, -- Full settings at time of computation
  rule_version VARCHAR(20) NOT NULL DEFAULT 'v1',
  
  -- Explanation and reasoning
  explanation_snapshot JSONB NOT NULL, -- Contains reasoningSteps array and metrics
  
  -- Context
  shift_start_time TIME NOT NULL,
  shift_end_time TIME NOT NULL,
  shift_date DATE NOT NULL,
  shift_duration_minutes INTEGER NOT NULL,
  
  -- Audit trail
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  computed_by VARCHAR(100) DEFAULT 'system', -- user id or 'system'
  context_metadata JSONB DEFAULT NULL, -- Weekly balancing context, payroll info, etc.
  
  -- Creation tracking
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indices for efficient queries
CREATE INDEX IF NOT EXISTS idx_shift_allocation_audit_tenant_id 
  ON shift_allocation_audit(tenant_id);

CREATE INDEX IF NOT EXISTS idx_shift_allocation_audit_shift_id 
  ON shift_allocation_audit(shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_allocation_audit_roster_pattern_id 
  ON shift_allocation_audit(roster_pattern_id);

CREATE INDEX IF NOT EXISTS idx_shift_allocation_audit_computed_at 
  ON shift_allocation_audit(computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_shift_allocation_audit_allocation_date 
  ON shift_allocation_audit(allocation_date);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_shift_allocation_audit_tenant_shift_date 
  ON shift_allocation_audit(tenant_id, shift_id, shift_date DESC);

-- Enable RLS
ALTER TABLE shift_allocation_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see audit records for their tenant
CREATE POLICY shift_allocation_audit_rls_tenant ON shift_allocation_audit
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY shift_allocation_audit_rls_insert ON shift_allocation_audit
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY shift_allocation_audit_rls_update ON shift_allocation_audit
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_shift_allocation_audit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shift_allocation_audit_updated_at_trigger
  BEFORE UPDATE ON shift_allocation_audit
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_allocation_audit_updated_at();

-- Grant access to authenticated users (RLS will filter by tenant)
GRANT SELECT, INSERT ON shift_allocation_audit TO authenticated;
GRANT UPDATE ON shift_allocation_audit TO authenticated;
