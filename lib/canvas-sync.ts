import type { EdgeChange, NodeChange } from "@xyflow/react";

type Selectable = { selected?: boolean };

function clearSelected<T extends Selectable>(item: T): T {
  return { ...item, selected: false };
}

/**
 * Selection is local to each collaborator. Drop select changes and
 * strip selected flags from add/replace payloads before they are
 * broadcast or applied from another client.
 */
export function withoutSharedSelection<T extends NodeChange | EdgeChange>(
  changes: T[],
): T[] {
  const result: T[] = [];
  for (const change of changes) {
    if (change.type === "select") continue;
    if (
      (change.type === "add" || change.type === "replace") &&
      "item" in change &&
      change.item &&
      typeof change.item === "object"
    ) {
      result.push({
        ...change,
        item: clearSelected(change.item as Selectable),
      } as T);
      continue;
    }
    result.push(change);
  }
  return result;
}

export function asUnselected<T extends Selectable>(item: T): T {
  return clearSelected(item);
}
