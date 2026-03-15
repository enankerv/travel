const STORAGE_KEY = "getawaygather_last_list";

export function getLastListId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setLastListId(listId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, listId);
}
