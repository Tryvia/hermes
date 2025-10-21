import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function NewTicket() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [tipoPrimario, setTipoPrimario] = useState("");
  const [tipo, setTipo] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTeams();
    fetchCurrentProfile();
  }, []);

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("*");
    setTeams(data || []);
  };

  const fetchCurrentProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setCurrentProfile(profile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) {
      toast.error("Erro ao identificar usuário");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("tickets")
      .insert([{
        title,
        description,
        priority: priority as "baixa" | "media" | "alta" | "urgente",
        tipo_primario: tipoPrimario,
        tipo,
        team_id: teamId || null,
        created_by: currentProfile.id,
      }])
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar ticket");
    } else {
      toast.success("Ticket criado com sucesso!");
      navigate(`/tickets/${data.id}`);
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/tickets")} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Tickets
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Criar Novo Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Digite o título do ticket"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    placeholder="Descreva o problema ou solicitação"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Equipe</Label>
                    <Select value={teamId} onValueChange={setTeamId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipoPrimario">Tipo Primário</Label>
                    <Input
                      id="tipoPrimario"
                      value={tipoPrimario}
                      onChange={(e) => setTipoPrimario(e.target.value)}
                      placeholder="Ex: Melhoria"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo</Label>
                    <Input
                      id="tipo"
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      placeholder="Ex: Melhoria BI"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Criando..." : "Criar Ticket"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/tickets")}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}