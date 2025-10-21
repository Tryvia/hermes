-- 1) Ensure app roles enum and user_roles table for RBAC
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','gerente','agente');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Policies for user_roles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can view own roles or admin') THEN
    CREATE POLICY "Users can view own roles or admin"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Only admin can modify roles') THEN
    CREATE POLICY "Only admin can modify roles"
    ON public.user_roles
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 2) Team membership and management
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_role') THEN
    CREATE TYPE public.team_role AS ENUM ('manager','member');
  END IF;
END $$;

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_role public.team_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, profile_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Helper: current user's profile id
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select p.id from public.profiles p where p.user_id = auth.uid();
$$;

-- Policies for team_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='Members can view their team memberships; managers and admin can view all in their teams') THEN
    CREATE POLICY "Members can view their team memberships; managers and admin can view all in their teams"
    ON public.team_members
    FOR SELECT
    TO authenticated
    USING (
      -- the row belongs to me
      profile_id = public.current_profile_id()
      OR
      -- I manage the team for this row
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.manager_id = public.current_profile_id()
      )
      OR public.has_role(auth.uid(), 'admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='Only team manager or admin can add members') THEN
    CREATE POLICY "Only team manager or admin can add members"
    ON public.team_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.manager_id = public.current_profile_id()
      )
      OR public.has_role(auth.uid(), 'admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='Only team manager or admin can update/delete members') THEN
    CREATE POLICY "Only team manager or admin can update/delete members"
    ON public.team_members
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.manager_id = public.current_profile_id()
      ) OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.manager_id = public.current_profile_id()
      ) OR public.has_role(auth.uid(), 'admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='teams' AND policyname='Only team manager or admin can update teams') THEN
    CREATE POLICY "Only team manager or admin can update teams"
    ON public.teams
    FOR UPDATE
    TO authenticated
    USING (
      manager_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
      manager_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin')
    );
  END IF;
END $$;

-- After creating a team, add creator as manager automatically
CREATE OR REPLACE FUNCTION public.add_creator_as_team_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid uuid;
BEGIN
  SELECT public.current_profile_id() INTO _pid;
  IF _pid IS NOT NULL THEN
    -- set manager if empty
    IF NEW.manager_id IS NULL THEN
      UPDATE public.teams SET manager_id = _pid WHERE id = NEW.id;
    END IF;
    -- add membership as manager
    INSERT INTO public.team_members (team_id, profile_id, team_role)
    VALUES (NEW.id, COALESCE(NEW.manager_id, _pid), 'manager')
    ON CONFLICT (team_id, profile_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_creator_as_team_manager ON public.teams;
CREATE TRIGGER trg_add_creator_as_team_manager
AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE PROCEDURE public.add_creator_as_team_manager();

-- 3) Custom fields for tickets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_type') THEN
    CREATE TYPE public.custom_field_type AS ENUM ('text','textarea','select','multiselect','number','date','boolean');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  type public.custom_field_type NOT NULL,
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  order_index int NOT NULL DEFAULT 0,
  team_id uuid NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- Values for custom fields per ticket
CREATE TABLE IF NOT EXISTS public.ticket_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value text,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, field_id)
);

ALTER TABLE public.ticket_custom_values ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_cf_updated_at ON public.custom_fields;
CREATE TRIGGER trg_cf_updated_at
BEFORE UPDATE ON public.custom_fields
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tcv_updated_at ON public.ticket_custom_values;
CREATE TRIGGER trg_tcv_updated_at
BEFORE UPDATE ON public.ticket_custom_values
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Policies for custom_fields
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_fields' AND policyname='Custom fields are viewable by authenticated users') THEN
    CREATE POLICY "Custom fields are viewable by authenticated users"
    ON public.custom_fields
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_fields' AND policyname='Admins, Gerentes or Team Managers can manage custom fields') THEN
    CREATE POLICY "Admins, Gerentes or Team Managers can manage custom fields"
    ON public.custom_fields
    FOR ALL
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gerente')
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.manager_id = public.current_profile_id()
      )
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gerente')
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.manager_id = public.current_profile_id()
      )
    );
  END IF;
END $$;

-- Policies for ticket_custom_values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ticket_custom_values' AND policyname='Custom values are viewable by authenticated users') THEN
    CREATE POLICY "Custom values are viewable by authenticated users"
    ON public.ticket_custom_values
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ticket_custom_values' AND policyname='Users who can work on the ticket can insert/update values') THEN
    CREATE POLICY "Users who can work on the ticket can insert/update values"
    ON public.ticket_custom_values
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id AND (
          -- ticket creator
          t.created_by = public.current_profile_id()
          OR
          -- member of the ticket team
          (t.team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = t.team_id AND tm.profile_id = public.current_profile_id()
          ))
          OR public.has_role(auth.uid(), 'admin')
        )
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ticket_custom_values' AND policyname='Users who can work on the ticket can update values') THEN
    CREATE POLICY "Users who can work on the ticket can update values"
    ON public.ticket_custom_values
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id AND (
          t.created_by = public.current_profile_id()
          OR (t.team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = t.team_id AND tm.profile_id = public.current_profile_id()
          ))
          OR public.has_role(auth.uid(), 'admin')
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id AND (
          t.created_by = public.current_profile_id()
          OR (t.team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = t.team_id AND tm.profile_id = public.current_profile_id()
          ))
          OR public.has_role(auth.uid(), 'admin')
        )
      )
    );
  END IF;
END $$;

-- 4) Create profiles on signup (fix ticket creation flow)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
