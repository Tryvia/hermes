import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type CustomField = {
  id: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "multiselect" | "number" | "date" | "boolean";
  options?: any;
  is_required: boolean;
  order_index: number;
};

interface Props {
  ticketId: string;
  teamId?: string | null;
}

export function TicketCustomFields({ ticketId, teamId }: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);

  const filter = useMemo(() => ({ teamId: teamId ?? null }), [teamId]);

  useEffect(() => {
    fetchFields();
    fetchValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, filter.teamId]);

  const fetchFields = async () => {
    // Global fields (team_id is null) + team-specific
    let query = supabase.from("custom_fields").select("*").order("order_index", { ascending: true });
    if (filter.teamId) {
      query = query.or(`team_id.is.null,team_id.eq.${filter.teamId}`);
    } else {
      query = query.is("team_id", null);
    }
    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar campos personalizados");
      return;
    }
    setFields((data as CustomField[]) || []);
  };

  const fetchValues = async () => {
    const { data, error } = await supabase
      .from("ticket_custom_values")
      .select("field_id,value")
      .eq("ticket_id", ticketId);
    if (error) return;
    const map: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      map[row.field_id] = row.value;
    });
    setValues(map);
  };

  const upsertValue = async (fieldId: string, value: any) => {
    setSaving(true);
    const { error } = await supabase
      .from("ticket_custom_values")
      .upsert(
        {
          ticket_id: ticketId,
          field_id: fieldId,
          value: typeof value === "string" ? value : JSON.stringify(value),
        },
        { onConflict: "ticket_id,field_id" }
      );
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar este campo");
    } else {
      toast.success("Campo salvo");
    }
  };

  const handleChange = (field: CustomField, raw: any) => {
    let v: any = raw;
    if (field.type === "number") v = raw === "" ? "" : Number(raw);
    if (field.type === "multiselect") {
      // store as comma separated string, display as CSV
      v = String(raw);
    }
    setValues((prev) => ({ ...prev, [field.id]: v }));
  };

  const renderField = (field: CustomField) => {
    const v = values[field.id] ?? "";
    switch (field.type) {
      case "text":
      case "number":
      case "date":
        return (
          <Input
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            value={String(v)}
            onChange={(e) => handleChange(field, e.target.value)}
            onBlur={() => upsertValue(field.id, values[field.id] ?? "")}
          />
        );
      case "textarea":
        return (
          <Textarea
            value={String(v)}
            onChange={(e) => handleChange(field, e.target.value)}
            onBlur={() => upsertValue(field.id, values[field.id] ?? "")}
          />
        );
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(v) === true}
              onCheckedChange={(checked) => {
                handleChange(field, checked);
                upsertValue(field.id, checked);
              }}
            />
          </div>
        );
      case "select": {
        const opts: string[] = Array.isArray(field.options) ? field.options : field.options?.options || [];
        return (
          <Select
            value={String(v)}
            onValueChange={(val) => {
              handleChange(field, val);
              upsertValue(field.id, val);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.label} />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case "multiselect":
        return (
          <Textarea
            placeholder="Valores separados por vírgula"
            value={String(v)}
            onChange={(e) => handleChange(field, e.target.value)}
            onBlur={() => upsertValue(field.id, values[field.id] ?? "")}
          />
        );
      default:
        return null;
    }
  };

  if (!fields.length) return null;

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-foreground">Campos Personalizados</div>
      {fields.map((f) => (
        <div key={f.id} className="space-y-2">
          <Label>{f.label}{f.is_required ? " *" : ""}</Label>
          {renderField(f)}
        </div>
      ))}
      {saving && (
        <div className="text-xs text-muted-foreground">Salvando...</div>
      )}
      <div className="pt-2">
        <Button type="button" variant="secondary" onClick={fetchValues}>Recarregar valores</Button>
      </div>
    </div>
  );
}
