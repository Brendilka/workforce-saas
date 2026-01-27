-- Create custom access token hook function
-- This adds tenant_id and role to JWT claims for RLS policies

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_tenant_id uuid;
  user_role text;
BEGIN
  -- Extract current claims from the event
  claims := event->'claims';

  -- Query the users table to get tenant_id and role
  -- This table links auth.users to your tenant system
  SELECT tenant_id, role::text INTO user_tenant_id, user_role
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  -- If user found, add tenant_id and role to JWT claims
  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{user_metadata}',
      jsonb_build_object(
        'tenant_id', user_tenant_id::text,
        'role', user_role
      ),
      true
    );
  END IF;

  -- Return the modified event with updated claims
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant necessary permissions
-- This allows Supabase Auth service to execute the function
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Revoke from other roles for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Add comment for documentation
COMMENT ON FUNCTION public.custom_access_token_hook IS
'Auth hook that adds tenant_id and role from public.users to JWT claims. Required for RLS policies to work.';
