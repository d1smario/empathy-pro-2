import type { SupabaseClient, User } from "@supabase/supabase-js";

export const AUTH_LIST_PAGE_SIZE = 200;
export const AUTH_LIST_MAX_PAGES = 50;

/**
 * Elenco completo utenti Supabase Auth (paginazione GoTrue fino a esaurimento).
 * Stessa strategia del report piattaforma — evita pagine tronche quando listUsers
 * restituisce meno righe del perPage richiesto ma ne restano altre.
 */
export async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];

  for (let page = 1; page <= AUTH_LIST_MAX_PAGES; page += 1) {
    const { data: pageData, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_LIST_PAGE_SIZE });
    if (error) throw new Error(error.message);
    users.push(...pageData.users);
    if (pageData.users.length < AUTH_LIST_PAGE_SIZE) break;
  }

  users.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (a.email ?? a.id).localeCompare(b.email ?? b.id);
  });

  return users;
}
