import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Ticket, Users, Clock, CheckCircle2 } from "lucide-react";
export default function Dashboard() {
  const [stats, setStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0,
    totalTeams: 0
  });
  const [teamStats, setTeamStats] = useState<any[]>([]);
  useEffect(() => {
    fetchStats();
    fetchTeamStats();
  }, []);
  const fetchStats = async () => {
    const {
      data: tickets
    } = await supabase.from("tickets").select("status");
    const {
      data: teams
    } = await supabase.from("teams").select("id");
    setStats({
      totalTickets: tickets?.length || 0,
      openTickets: tickets?.filter(t => t.status === "aberto" || t.status === "em_andamento").length || 0,
      resolvedTickets: tickets?.filter(t => t.status === "resolvido" || t.status === "fechado").length || 0,
      totalTeams: teams?.length || 0
    });
  };
  const fetchTeamStats = async () => {
    const {
      data: teams
    } = await supabase.from("teams").select(`
      id,
      name,
      tickets:tickets(status)
    `);
    const formattedStats = teams?.map((team: any) => ({
      name: team.name,
      abertos: team.tickets?.filter((t: any) => t.status === "aberto").length || 0,
      em_andamento: team.tickets?.filter((t: any) => t.status === "em_andamento").length || 0,
      resolvidos: team.tickets?.filter((t: any) => t.status === "resolvido" || t.status === "fechado").length || 0
    })) || [];
    setTeamStats(formattedStats);
  };
  return <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visão geral do sistema de chamados</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTickets}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tickets Abertos</CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{stats.openTickets}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tickets Resolvidos</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{stats.resolvedTickets}</div>
              </CardContent>
            </Card>

            
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance por Equipe</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={teamStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="abertos" fill="hsl(var(--warning))" name="Abertos" />
                  <Bar dataKey="em_andamento" fill="hsl(var(--chart-2))" name="Em Andamento" />
                  <Bar dataKey="resolvidos" fill="hsl(var(--success))" name="Resolvidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>;
}