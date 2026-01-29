-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workload Patterns (recurring templates)
CREATE TABLE workload_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  job_title TEXT,
  skill_profile TEXT,
  recurrence TEXT NOT NULL, -- 'daily', 'weekly', 'custom'
  start_date DATE NOT NULL,
  end_date DATE, -- NULL means forever
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  CONSTRAINT check_job_or_skill CHECK (
    (job_title IS NOT NULL AND skill_profile IS NULL) OR
    (job_title IS NULL AND skill_profile IS NOT NULL)
  )
);

-- Pattern details per day of week or specific config
CREATE TABLE workload_pattern_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES workload_patterns(id) ON DELETE CASCADE,
  day_of_week INTEGER, -- 0=Sun, 1=Mon, etc. NULL for daily patterns
  span_start TIME,
  span_end TIME,
  required_headcount INTEGER NOT NULL DEFAULT 0,
  required_hours DECIMAL(5,2),
  notes TEXT
);

-- Actual workload requirements (computed from patterns + overrides)
CREATE TABLE workload_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  job_title TEXT,
  skill_profile TEXT,
  requirement_date DATE NOT NULL,
  span_start TIME,
  span_end TIME,
  required_headcount INTEGER NOT NULL DEFAULT 0,
  required_hours DECIMAL(5,2),
  source_pattern_id UUID REFERENCES workload_patterns(id) ON DELETE SET NULL,
  is_override BOOLEAN DEFAULT false, -- manually edited cell
  is_published BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT check_job_or_skill_req CHECK (
    (job_title IS NOT NULL AND skill_profile IS NULL) OR
    (job_title IS NULL AND skill_profile IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_workload_patterns_tenant ON workload_patterns(tenant_id);
CREATE INDEX idx_workload_patterns_location ON workload_patterns(location_id);
CREATE INDEX idx_workload_patterns_dates ON workload_patterns(start_date, end_date);

CREATE INDEX idx_workload_pattern_details_pattern ON workload_pattern_details(pattern_id);

CREATE INDEX idx_workload_requirements_tenant ON workload_requirements(tenant_id);
CREATE INDEX idx_workload_requirements_location ON workload_requirements(location_id);
CREATE INDEX idx_workload_requirements_date ON workload_requirements(requirement_date);
CREATE INDEX idx_workload_requirements_published ON workload_requirements(is_published);

-- RLS Policies
ALTER TABLE workload_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_pattern_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_requirements ENABLE ROW LEVEL SECURITY;

-- Workload Patterns policies
CREATE POLICY "Users can view workload patterns in their tenant"
  ON workload_patterns FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins and managers can create workload patterns"
  ON workload_patterns FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can update workload patterns"
  ON workload_patterns FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can delete workload patterns"
  ON workload_patterns FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- Pattern Details policies
CREATE POLICY "Users can view pattern details in their tenant"
  ON workload_pattern_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workload_patterns 
      WHERE id = workload_pattern_details.pattern_id
      AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins and managers can manage pattern details"
  ON workload_pattern_details FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workload_patterns 
      WHERE id = workload_pattern_details.pattern_id
      AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- Workload Requirements policies
CREATE POLICY "Users can view workload requirements in their tenant"
  ON workload_requirements FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins and managers can manage workload requirements"
  ON workload_requirements FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- Function to apply pattern to date range
CREATE OR REPLACE FUNCTION apply_workload_pattern(
  p_pattern_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_pattern RECORD;
  v_detail RECORD;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Get pattern info
  SELECT * INTO v_pattern FROM workload_patterns WHERE id = p_pattern_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pattern not found';
  END IF;
  
  -- Loop through date range
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date);
    
    -- Insert requirements for matching pattern details
    FOR v_detail IN 
      SELECT * FROM workload_pattern_details 
      WHERE pattern_id = p_pattern_id
      AND (day_of_week IS NULL OR day_of_week = v_day_of_week)
    LOOP
      INSERT INTO workload_requirements (
        tenant_id, location_id, job_title, skill_profile,
        requirement_date, span_start, span_end,
        required_headcount, required_hours,
        source_pattern_id, is_override
      ) VALUES (
        v_pattern.tenant_id, v_pattern.location_id, 
        v_pattern.job_title, v_pattern.skill_profile,
        v_current_date, v_detail.span_start, v_detail.span_end,
        v_detail.required_headcount, v_detail.required_hours,
        p_pattern_id, false
      )
      ON CONFLICT DO NOTHING;
      
      v_count := v_count + 1;
    END LOOP;
    
    v_current_date := v_current_date + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
