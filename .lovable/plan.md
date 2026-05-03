
## Fix: Backup ZIP still failing

The `supabase.functions.invoke()` doesn't support query parameters appended to the function name. The fix is to use `fetch()` directly with the full edge function URL and query params.

### Change in `src/components/admin/BackupStorageCard.tsx`

Replace the `fetchBackupApi` function to use direct `fetch()` instead of `supabase.functions.invoke()`:

```typescript
async function fetchBackupApi(params: Record<string, string>) {
  const token = await getAuthToken();
  const queryString = new URLSearchParams(params).toString();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/backup-storage?${queryString}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Erro ${response.status}`);
  }
  return response.json();
}
```

This ensures query params (`mode=summary`, `mode=files&bucket=...&page=...`) are properly sent to the edge function.
