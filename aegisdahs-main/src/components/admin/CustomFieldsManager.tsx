import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

type FieldType = "text" | "textarea" | "select" | "multiselect" | "number" | "date" | "boolean";

export function CustomFieldsManager() {
  const [fields, setFields] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);

  // Form state
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [teamId, setTeamId] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [orderIndex, setOrderIndex] = useState(0);
  const [options, setOptions] = useState(""); // for select/multiselect

  useEffect(() => {
    fetchCurrentUser();
    fetchFields();
    fetchTeams();
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

  const fetchFields = async () => {
    const { data } = await supabase
      .from("custom_fields")
      .select("*, team:teams(name)")
      .order("order_index");
    setFields(data || []);
  };

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("*");
    setTeams(data || []);
  };

  const resetForm = () => {
    setKey("");
    setLabel("");
    setType("text");
    setTeamId("");
    setIsRequired(false);
    setOrderIndex(0);
    setOptions("");
    setEditingField(null);
  };

  const openDialog = (field?: any) => {
    if (field) {
      setEditingField(field);
      setKey(field.key);
      setLabel(field.label);
      setType(field.type);
      setTeamId(field.team_id || "");
      setIsRequired(field.is_required);
      setOrderIndex(field.order_index);
      setOptions(Array.isArray(field.options) ? field.options.join(", ") : field.options?.options?.join(", ") || "");
    } else {
      resetForm();
      setOrderIndex(fields.length);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const fieldData = {
      key,
      label,
      type,
      team_id: teamId || null,
      is_required: isRequired,
      order_index: orderIndex,
      options: (type === "select" || type === "multiselect") 
        ? { options: options.split(",").map(o => o.trim()).filter(Boolean) }
        : null,
      created_by: currentUser?.id,
    };

    let error;
    if (editingField) {
      ({ error } = await supabase
        .from("custom_fields")
        .update(fieldData)
        .eq("id", editingField.id));
    } else {
      ({ error } = await supabase
        .from("custom_fields")
        .insert([fieldData]));
    }

    if (error) {
      toast.error("Erro ao salvar campo personalizado");
    } else {
      toast.success(`Campo ${editingField ? 'atualizado' : 'criado'} com sucesso!`);
      setIsDialogOpen(false);
      resetForm();
      fetchFields();
    }

    setLoading(false);
  };

  const handleDelete = async (field: any) => {
    if (!confirm(`Tem certeza que deseja excluir o campo "${field.label}"?`)) return;

    const { error } = await supabase
      .from("custom_fields")
      .delete()
      .eq("id", field.id);

    if (error) {
      toast.error("Erro ao excluir campo");
    } else {
      toast.success("Campo excluído com sucesso!");
      fetchFields();
    }
  };

  const canManageFields = userRoles.includes("admin") || userRoles.includes("gerente") || 
    teams.some(team => team.manager_id === currentUser?.id);

  if (!canManageFields) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Você não tem permissão para gerenciar campos personalizados.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Campos Personalizados</h2>
          <p className="text-muted-foreground">Configure campos adicionais para tickets</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Campo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingField ? 'Editar' : 'Criar'} Campo Personalizado</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key">Chave *</Label>
                <Input
                  id="key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Ex: sistema"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Rótulo *</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Sistema"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Campo</Label>
                <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="textarea">Texto Longo</SelectItem>
                    <SelectItem value="select">Seleção</SelectItem>
                    <SelectItem value="multiselect">Múltipla Seleção</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="date">Data</SelectItem>
                    <SelectItem value="boolean">Sim/Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(type === "select" || type === "multiselect") && (
                <div className="space-y-2">
                  <Label htmlFor="options">Opções (separadas por vírgula)</Label>
                  <Textarea
                    id="options"
                    value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    placeholder="Opção 1, Opção 2, Opção 3"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Equipe (deixe vazio para global)</Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os times</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="required"
                  checked={isRequired}
                  onCheckedChange={setIsRequired}
                />
                <Label htmlFor="required">Campo obrigatório</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order">Ordem</Label>
                <Input
                  id="order"
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Salvando..." : editingField ? "Atualizar" : "Criar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {fields.map((field) => (
          <Card key={field.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{field.label}</CardTitle>
                  <CardDescription>
                    <code className="text-xs bg-muted px-1 rounded">{field.key}</code>
                    {field.team && (
                      <Badge variant="secondary" className="ml-2">
                        {field.team.name}
                      </Badge>
                    )}
                    {field.is_required && (
                      <Badge variant="destructive" className="ml-2">
                        Obrigatório
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openDialog(field)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(field)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Tipo: <span className="font-medium">{field.type}</span>
                {field.options && (
                  <>
                    {" • "}Opções: {Array.isArray(field.options) ? field.options.join(", ") : field.options?.options?.join(", ")}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {fields.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Nenhum campo personalizado criado ainda.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}