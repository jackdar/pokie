import {
  parseGameTemplates,
  withTemplate,
  withoutTemplate,
  type GameTemplate,
} from "@/ui/gameTemplates.ts";

const templatesKey = "pokie.gameTemplates";

// Storage can be missing or blocked, for example in a private window. Then the device has no templates.
export function gameTemplates(): GameTemplate[] {
  try {
    const raw = localStorage.getItem(templatesKey);
    return raw ? parseGameTemplates(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** Returns false when the device cannot store the templates. */
function writeTemplates(templates: GameTemplate[]): boolean {
  try {
    localStorage.setItem(templatesKey, JSON.stringify(templates));
    return true;
  } catch {
    return false;
  }
}

/** Saves the template. A template with the same name is replaced. Returns false when the save fails. */
export function saveGameTemplate(template: GameTemplate): boolean {
  return writeTemplates(withTemplate(gameTemplates(), template));
}

/** Returns false when the device cannot store the change. */
export function deleteGameTemplate(name: string): boolean {
  return writeTemplates(withoutTemplate(gameTemplates(), name));
}
