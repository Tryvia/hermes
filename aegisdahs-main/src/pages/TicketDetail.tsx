import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { TicketCustomFields } from "@/components/tickets/TicketCustomFields";

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    fetchCurrentUser();
    fetchTicket();
    fetchInteractions();
    fetchTeams();
  }, [id]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const fetchTicket = async () => {
    const { data } = await supabase
      .from("tickets")
      .select(`
        *,
        created_by:profiles!tickets_created_by_fkey(id, full_name),
        assigned_to:profiles!tickets_assigned_to_fkey(id, full_name),
        team:teams(id, name)
      `)
      .eq("id", id)
      .single();

    setTicket(data);
  };

  const fetchInteractions = async () => {
    const { data } = await supabase
      .from("ticket_interactions")
      .select(`
        *,
        user:profiles(full_name)
      `)
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    setInteractions(data || []);
  };

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("*");
    setTeams(data || []);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    const { error } = await supabase.from("ticket_interactions").insert({
      ticket_id: id,
      user_id: currentUser.id,
      content: newComment,
      interaction_type: "comment",
    });

    if (error) {
      toast.error("Erro ao adicionar comentário");
    } else {
      setNewComment("");
      fetchInteractions();
      toast.success("Comentário adicionado!");
    }
  };

  const handleUpdateTicket = async (field: string, value: any) => {
    const { error } = await supabase
      .from("tickets")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar ticket");
    } else {
      fetchTicket();
      toast.success("Ticket atualizado!");
    }
  };

  if (!ticket) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Calcula o histórico de usuários únicos que interagiram
  const uniqueUsers = interactions.reduce((acc: any[], interaction: any) => {
    const existingUser = acc.find(u => u.user.full_name === interaction.user.full_name);
    if (!existingUser) {
      acc.push({
        user: interaction.user,
        count: 1,
        lastInteraction: interaction.created_at
      });
    } else {
      existingUser.count++;
      existingUser.lastInteraction = interaction.created_at;
    }
    return acc;
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Button variant="ghost" onClick={() => navigate("/tickets")} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Tickets
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left side - Conversation */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h1 className="text-2xl font-bold mb-4">{ticket.title}</h1>
                  <p className="text-muted-foreground mb-4">{ticket.description}</p>
                  <div className="text-sm text-muted-foreground">
                    Criado por {ticket.created_by?.full_name} •{" "}
                    {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                  </div>
                </CardContent>
              </Card>

              {/* Interactions */}
              <div className="space-y-4">
                {interactions.map((interaction) => (
                  <Card key={interaction.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(interaction.user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">{interaction.user.full_name}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-foreground">{interaction.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Add comment */}
              <Card>
                <CardContent className="p-4">
                  <Textarea
                    placeholder="Adicionar tratativa..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="mb-2"
                  />
                  <Button onClick={handleAddComment}>Adicionar Tratativa</Button>
                </CardContent>
              </Card>

              {/* User interaction history */}
              {uniqueUsers.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Histórico de Tratativas por Usuário</h3>
                    <div className="space-y-3">
                      {uniqueUsers.map((userStat: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {getInitials(userStat.user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{userStat.user.full_name}</div>
                              <div className="text-sm text-muted-foreground">
                                Última interação: {formatDistanceToNow(new Date(userStat.lastInteraction), { addSuffix: true, locale: ptBR })}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary">{userStat.count} tratativa{userStat.count > 1 ? 's' : ''}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right side - Properties */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold text-lg mb-4">PROPRIEDADES</h3>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={ticket.status} onValueChange={(value) => handleUpdateTicket("status", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="aguardando_cliente">Aguardando Cliente</SelectItem>
                        <SelectItem value="resolvido">Resolvido</SelectItem>
                        <SelectItem value="fechado">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={ticket.priority} onValueChange={(value) => handleUpdateTicket("priority", value)}>
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
                    <Select value={ticket.team_id || ""} onValueChange={(value) => handleUpdateTicket("team_id", value || null)}>
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

                  <div className="space-y-2">
                    <Label>Tipo Primário</Label>
                    <Input
                      value={ticket.tipo_primario || ""}
                      onChange={(e) => handleUpdateTicket("tipo_primario", e.target.value)}
                      placeholder="Ex: Melhoria"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Input
                      value={ticket.tipo || ""}
                      onChange={(e) => handleUpdateTicket("tipo", e.target.value)}
                      placeholder="Ex: Melhoria BI"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Custom Fields */}
              <Card>
                <CardContent className="p-6">
                  <TicketCustomFields ticketId={id!} teamId={ticket.team_id} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}