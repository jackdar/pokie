import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameTemplate } from "@/ui/gameTemplates.ts";

type GameTemplateListProps = {
  templates: GameTemplate[];
  onUse: (template: GameTemplate) => void;
  onDelete: (template: GameTemplate) => void;
};

/** The setups saved on this device. Picking one fills in the new-game form. */
export function GameTemplateList({ templates, onUse, onDelete }: GameTemplateListProps) {
  if (templates.length === 0) return null;
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-medium">Start from a template</legend>
      <ul className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <li key={template.name} className="flex items-center rounded-full border">
            <Button
              type="button"
              variant="ghost"
              className="rounded-l-full rounded-r-none"
              onClick={() => onUse(template)}
            >
              {template.name}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-l-none rounded-r-full"
              aria-label={`Delete template ${template.name}`}
              onClick={() => onDelete(template)}
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
