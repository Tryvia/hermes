import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Plus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  team_role: "manager" | "member";
  profile: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface Team {
  id: string;
  name: string;
  manager_id?: string;
  members: TeamMember[];
}

export function TeamMembersManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"member" | "manager">("member");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchTeams();
    fetchProfiles();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setCurrentUser(profile);

      // Get user roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      setUserRoles(roles?.map(r => r.role) || []);
    }
  };

  const fetchTeams = async () => {
    const { data } = await supabase
      .from("teams")
      .select(`
        *,
        members:team_members(
          id,
          team_role,
          profile:profiles(id, full_name, email)
        )
      `);
    setTeams(data || []);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");
    setAllProfiles(data || []);
  };

  const canManageTeam = (team: Team) => {
    return userRoles.includes("admin") || team.manager_id === currentUser?.id;
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !selectedProfile) return;

    setLoading(true);
    const { error } = await supabase
      .from("team_members")
      .insert([{
        team_id: selectedTeam,
        profile_id: selectedProfile,
        team_role: selectedRole,
      }]);

    if (error) {
      toast.error("Erro ao adicionar membro");
    } else {
      toast.success("Membro adicionado com sucesso!");
      setIsDialogOpen(false);
      setSelectedTeam("");
      setSelectedProfile("");
      setSelectedRole("member");
      fetchTeams();
    }
    setLoading(false);
  };

  const handleRemoveMember = async (memberId: string, teamName: string, memberName: string) => {
    if (!confirm(`Remover ${memberName} da equipe ${teamName}?`)) return;

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast.error("Erro ao remover membro");
    } else {
      toast.success("Membro removido com sucesso!");
      fetchTeams();
    }
  };

  const handleChangeRole = async (memberId: string, newRole: "member" | "manager") => {
    const { error } = await supabase
      .from("team_members")
      .update({ team_role: newRole })
      .eq("id", memberId);

    if (error) {
      toast.error("Erro ao alterar função");
    } else {
      toast.success("Função alterada com sucesso!");
      fetchTeams();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const managedTeams = teams.filter(canManageTeam);

  if (managedTeams.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Você não gerencia nenhuma equipe.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Membros das Equipes</h2>
          <p className="text-muted-foreground">Adicione e remova membros das suas equipes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Equipe</label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {managedTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Usuário</label>
                <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name} ({profile.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Função</label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddMember} disabled={loading} className="flex-1">
                  {loading ? "Adicionando..." : "Adicionar"}
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {managedTeams.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-primary" />
                <div>
                  <CardTitle>{team.name}</CardTitle>
                  <CardDescription>{team.members?.length || 0} membros</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {team.members?.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(member.profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.profile.full_name}</div>
                        <div className="text-sm text-muted-foreground">{member.profile.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.team_role === "manager" ? "default" : "secondary"}>
                        {member.team_role === "manager" ? (
                          <>
                            <Shield className="w-3 h-3 mr-1" />
                            Gerente
                          </>
                        ) : (
                          "Membro"
                        )}
                      </Badge>
                      {userRoles.includes("admin") && (
                        <Select
                          value={member.team_role}
                          onValueChange={(role) => handleChangeRole(member.id, role as any)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Membro</SelectItem>
                            <SelectItem value="manager">Gerente</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id, team.name, member.profile.full_name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!team.members || team.members.length === 0) && (
                  <div className="text-center py-4 text-muted-foreground">
                    Nenhum membro nesta equipe ainda.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}