-- RPC to fetch invite details by token. Returns one row only - caller must know the token.
-- SECURITY DEFINER bypasses RLS so invitees (who aren't list members yet) can read.
-- Caller cannot enumerate tokens; they only get back the invite for the token they pass.

CREATE OR REPLACE FUNCTION public.get_invite_for_accept(lookup_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'token', it.token,
    'list_id', it.list_id,
    'list_name', l.name,
    'role', it.role,
    'expires_at', it.expires_at,
    'uses_count', it.uses_count,
    'max_uses', it.max_uses
  ) INTO result
  FROM invite_tokens it
  JOIN lists l ON l.id = it.list_id
  WHERE it.token = lookup_token
    AND it.is_active = true
    AND (it.expires_at IS NULL OR it.expires_at > NOW())
    AND (it.max_uses IS NULL OR it.uses_count < it.max_uses);

  RETURN result;
END;
$$;

-- RPC to accept an invite. Validates token, adds user to list, increments uses.
-- SECURITY DEFINER so invitee can add themselves (bypasses list_members RLS).
CREATE OR REPLACE FUNCTION public.accept_invite_rpc(lookup_token text, joining_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok invite_tokens%ROWTYPE;
  new_member json;
BEGIN
  SELECT * INTO tok
  FROM invite_tokens
  WHERE token = lookup_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite token';
  END IF;

  INSERT INTO list_members (list_id, user_id, role, invited_by)
  VALUES (tok.list_id, joining_user_id, tok.role, tok.created_by)
  ON CONFLICT (list_id, user_id) DO UPDATE SET role = tok.role, invited_by = tok.created_by
  RETURNING to_json(list_members.*) INTO new_member;

  UPDATE invite_tokens SET uses_count = uses_count + 1 WHERE id = tok.id;

  RETURN json_build_object('ok', true, 'member', new_member);
END;
$$;

-- Allow authenticated users to call these RPCs
GRANT EXECUTE ON FUNCTION public.get_invite_for_accept(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite_rpc(text, uuid) TO authenticated;
