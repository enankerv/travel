-- Make list creator a list_member so policies work uniformly
-- Run after schema + storage setup (needs is_list_member)

-- Add is_creator to identify the owner in members list
ALTER TABLE list_members ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT false;

-- Trigger: add creator as list_member when list is created
CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO list_members (list_id, user_id, role, is_creator)
  VALUES (NEW.id, NEW.user_id, 'admin', true)
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_list_created_add_creator ON lists;
CREATE TRIGGER on_list_created_add_creator
  AFTER INSERT ON lists
  FOR EACH ROW EXECUTE PROCEDURE public.add_creator_as_member();

-- Allow list members to read lists (SECURITY DEFINER avoids recursion)
CREATE OR REPLACE FUNCTION public.can_view_list(check_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM lists l WHERE l.id = check_list_id AND l.user_id = auth.uid())
  OR public.is_list_member(check_list_id, auth.uid());
$$;

DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
DROP POLICY IF EXISTS "Users can view lists they own or are members of" ON lists;
CREATE POLICY "Users can view lists they own or are members of"
  ON lists FOR SELECT
  USING (can_view_list(id));

-- Ensure INSERT policy exists (required for creating lists)
DROP POLICY IF EXISTS "Users can create lists" ON lists;
CREATE POLICY "Users can create lists"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RPC to create list (bypasses RLS; uses auth.uid() from JWT)
CREATE OR REPLACE FUNCTION public.create_list_rpc(list_name text, list_description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_row lists%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '42501';
  END IF;
  INSERT INTO lists (user_id, name, description)
  VALUES (auth.uid(), list_name, list_description)
  RETURNING * INTO new_row;
  RETURN to_jsonb(new_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_list_rpc(text, text) TO authenticated;

-- Backfill: add creator to list_members for existing lists
INSERT INTO list_members (list_id, user_id, role, is_creator)
SELECT l.id, l.user_id, 'admin', true
FROM lists l
WHERE NOT EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = l.id AND lm.user_id = l.user_id)
ON CONFLICT (list_id, user_id) DO NOTHING;
