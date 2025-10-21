-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket status enum
CREATE TYPE ticket_status AS ENUM ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado');

-- Create ticket priority enum
CREATE TYPE ticket_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status ticket_status NOT NULL DEFAULT 'aberto',
  priority ticket_priority NOT NULL DEFAULT 'media',
  tipo_primario TEXT,
  tipo TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id),
  team_id UUID REFERENCES public.teams(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket interactions (tratativas) table
CREATE TABLE public.ticket_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  content TEXT NOT NULL,
  interaction_type TEXT DEFAULT 'comment',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
CREATE POLICY "Teams are viewable by authenticated users"
  ON public.teams FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teams can be created by authenticated users"
  ON public.teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Teams can be updated by authenticated users"
  ON public.teams FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for tickets
CREATE POLICY "Tickets are viewable by authenticated users"
  ON public.tickets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Tickets can be created by authenticated users"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Tickets can be updated by authenticated users"
  ON public.tickets FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for ticket interactions
CREATE POLICY "Interactions are viewable by authenticated users"
  ON public.ticket_interactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Interactions can be created by authenticated users"
  ON public.ticket_interactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically create profile for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();