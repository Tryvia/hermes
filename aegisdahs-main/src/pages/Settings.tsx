import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CustomFieldsManager } from "@/components/admin/CustomFieldsManager";
import { TeamMembersManager } from "@/components/admin/TeamMembersManager";

export default function Settings() {
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchTeams();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*, team:teams(id, name)")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setFullName(data.full_name);
        setTeamId(data.team_id || "");
      }

      // Get user roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      setUserRoles(roles?.map(r => r.role) || []);
    }
  };

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("*");
    setTeams(data || []);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        team_id: teamId || null,
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("Erro ao atualizar perfil");
    } else {
      toast.success("Perfil atualizado com sucesso!");
      fetchProfile();
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground mt-1">Gerencie o sistema e suas informações pessoais</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="custom-fields">Campos Personalizados</TabsTrigger>
              <TabsTrigger value="team-members">Membros da Equipe</TabsTrigger>
              <TabsTrigger value="system">Sistema</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Perfil</CardTitle>
                  <CardDescription>Atualize suas informações pessoais</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile?.email || ""}
                        disabled
                      />
                      <p className="text-sm text-muted-foreground">O email não pode ser alterado</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Equipe</Label>
                      <Select value={teamId} onValueChange={setTeamId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma equipe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhuma equipe</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Funções no Sistema</Label>
                      <div className="text-sm text-muted-foreground">
                        {userRoles.length > 0 ? userRoles.join(", ") : "Nenhuma função atribuída"}
                      </div>
                    </div>

                    <Button type="submit" disabled={loading}>
                      {loading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="custom-fields">
              <CustomFieldsManager />
            </TabsContent>

            <TabsContent value="team-members">
              <TeamMembersManager />
            </TabsContent>

            <TabsContent value="system">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações do Sistema</CardTitle>
                  <CardDescription>Configurações gerais do portal de chamados</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Funcionalidades administrativas em desenvolvimento.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}