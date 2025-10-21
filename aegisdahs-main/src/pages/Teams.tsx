import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export default function Teams() {
  const [teams, setTeams] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    const { data } = await supabase
      .from("teams")
      .select(`
        *,
        members:profiles(id, full_name),
        tickets:tickets(id, status)
      `);

    setTeams(data || []);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("teams").insert({
      name: newTeamName,
      description: newTeamDescription,
    });

    if (error) {
      toast.error("Erro ao criar equipe");
    } else {
      toast.success("Equipe criada com sucesso!");
      setNewTeamName("");
      setNewTeamDescription("");
      setOpen(false);
      fetchTeams();
    }
  };

  const getTeamStats = (team: any) => {
    const totalTickets = team.tickets?.length || 0;
    const openTickets = team.tickets?.filter((t: any) => t.status === "aberto" || t.status === "em_andamento").length || 0;
    const completedTickets = team.tickets?.filter((t: any) => t.status === "resolvido" || t.status === "fechado").length || 0;
    const percentage = totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0;

    return { totalTickets, openTickets, completedTickets, percentage };
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Equipes</h1>
              <p className="text-muted-foreground mt-1">Gerencie as equipes do sistema</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Equipe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Equipe</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      required
                      placeholder="Nome da equipe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={newTeamDescription}
                      onChange={(e) => setNewTeamDescription(e.target.value)}
                      placeholder="Descrição da equipe"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Criar Equipe
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => {
              const stats = getTeamStats(team);
              return (
                <Card key={team.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle>{team.name}</CardTitle>
                        <CardDescription>{team.members?.length || 0} membros</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {team.description && (
                      <p className="text-sm text-muted-foreground">{team.description}</p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{stats.percentage}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted rounded-lg p-2">
                        <div className="text-lg font-bold">{stats.totalTickets}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="bg-warning/10 rounded-lg p-2">
                        <div className="text-lg font-bold text-warning">{stats.openTickets}</div>
                        <div className="text-xs text-muted-foreground">Abertos</div>
                      </div>
                      <div className="bg-success/10 rounded-lg p-2">
                        <div className="text-lg font-bold text-success">{stats.completedTickets}</div>
                        <div className="text-xs text-muted-foreground">Concluídos</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}