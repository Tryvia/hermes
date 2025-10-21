import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Tickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("tickets")
      .select(`
        *,
        created_by:profiles!tickets_created_by_fkey(full_name),
        assigned_to:profiles!tickets_assigned_to_fkey(full_name),
        team:teams(name)
      `)
      .order("created_at", { ascending: false });

    setTickets(data || []);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      aberto: "destructive",
      em_andamento: "default",
      aguardando_cliente: "secondary",
      resolvido: "outline",
      fechado: "outline",
    };

    const labels: Record<string, string> = {
      aberto: "Aberto",
      em_andamento: "Em Andamento",
      aguardando_cliente: "Aguardando Cliente",
      resolvido: "Resolvido",
      fechado: "Fechado",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      urgente: "bg-destructive text-destructive-foreground",
      alta: "bg-warning text-white",
      media: "bg-primary text-primary-foreground",
      baixa: "bg-secondary text-secondary-foreground",
    };

    const labels: Record<string, string> = {
      urgente: "Urgente",
      alta: "Alta",
      media: "Média",
      baixa: "Baixa",
    };

    return (
      <Badge className={colors[priority]}>
        {labels[priority] || priority}
      </Badge>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Tickets</h1>
              <p className="text-muted-foreground mt-1">Gerencie todos os chamados</p>
            </div>
            <Button onClick={() => navigate("/tickets/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Ticket
            </Button>
          </div>

          <div className="grid gap-4">
            {tickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{ticket.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {ticket.description?.substring(0, 150)}
                        {ticket.description?.length > 150 && "..."}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>
                      Criado por: <span className="font-medium text-foreground">{ticket.created_by?.full_name}</span>
                    </span>
                    {ticket.assigned_to && (
                      <span>
                        Atribuído a: <span className="font-medium text-foreground">{ticket.assigned_to?.full_name}</span>
                      </span>
                    )}
                    {ticket.team && (
                      <span>
                        Equipe: <span className="font-medium text-foreground">{ticket.team.name}</span>
                      </span>
                    )}
                    <span className="ml-auto">
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}