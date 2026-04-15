import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getPluggyApiKey(): Promise<string> {
  const clientId = Deno.env.get('PLUGGY_CLIENT_ID');
  const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Missing Pluggy credentials');

  const res = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Pluggy auth failed: ${await res.text()}`);
  return (await res.json()).apiKey;
}

async function fetchAccounts(apiKey: string, itemId: string) {
  const res = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, {
    headers: { 'X-API-KEY': apiKey },
  });
  if (!res.ok) throw new Error(`Failed to fetch accounts: ${await res.text()}`);
  return (await res.json()).results || [];
}

async function fetchTransactions(apiKey: string, accountId: string, fromDate?: string, toDate?: string) {
  const all: any[] = [];
  let page = 1;
  const pageSize = 500;
  while (true) {
    let url = `https://api.pluggy.ai/transactions?accountId=${accountId}&pageSize=${pageSize}&page=${page}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;
    
    console.log(`[SYNC] Fetching page ${page}: ${url}`);
    const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } });
    if (!res.ok) throw new Error(`Failed to fetch transactions page ${page}: ${await res.text()}`);
    
    const data = await res.json();
    const results = data.results || [];
    all.push(...results);
    if (results.length < pageSize || all.length >= (data.total || 0)) break;
    page++;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { itemId, userId, fromDate, force } = await req.json();
    if (!itemId || !userId) throw new Error('itemId and userId are required');

    console.log(`[SYNC] Request: item=${itemId}, force=${force}`);

    // Check if item exists in our records to avoid sync of deleted items
    const { data: itemConnections, error: connError } = await supabase
      .from('pluggy_connections')
      .select('id, pluggy_account_id, wallet_id')
      .eq('pluggy_item_id', itemId)
      .eq('user_id', userId);

    if (connError || !itemConnections || itemConnections.length === 0) {
      console.log(`[SYNC] Item ${itemId} not found in pluggy_connections. Skipping.`);
      return new Response(
        JSON.stringify({ success: true, message: 'Item not mapped. Sync skipped.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activeAcountIds = itemConnections.map(c => c.pluggy_account_id);

    // FORCE MODE: Delete existing staged transactions for this item before refetching
    if (force === true) {
      console.log(`[SYNC] FORCE MODE ACTIVE: Deleting existing staged transactions for accounts: ${activeAcountIds.join(', ')}`);
      
      const { error: delError } = await supabase
        .from('staged_transactions')
        .delete()
        .eq('user_id', userId)
        .in('pluggy_account_id', activeAcountIds);
      
      if (delError) console.error(`[SYNC] Error clearing staged transactions: ${delError.message}`);
      else console.log(`[SYNC] Cleared staged transactions for ${activeAcountIds.length} accounts`);
    }

    const from = fromDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const to = tomorrow.toISOString().split('T')[0];

    const apiKey = await getPluggyApiKey();
    const accounts = await fetchAccounts(apiKey, itemId);

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const account of accounts) {
      const accountId = account.id;

      // Ensure we only sync accounts that are still in our pluggy_connections
      const connectionMapping = itemConnections.find(c => c.pluggy_account_id === accountId);
      if (!connectionMapping) {
        console.log(`[SYNC] Account ${accountId} is not mapped in pluggy_connections. Skipping this account.`);
        continue;
      }

      const walletId = connectionMapping.wallet_id || null;
      const transactions = await fetchTransactions(apiKey, accountId, from, to);

      for (const tx of transactions) {
        const pluggyTxId = tx.id;
        
        // Skip if exists (unless force mode deleted it already)
        const { data: existing } = await supabase
          .from('staged_transactions')
          .select('id')
          .eq('pluggy_transaction_id', pluggyTxId)
          .maybeSingle();
        
        if (existing) { totalSkipped++; continue; }

        const { error } = await supabase.from('staged_transactions').insert({
          user_id: userId,
          pluggy_transaction_id: pluggyTxId,
          pluggy_account_id: accountId,
          description: tx.description || tx.descriptionRaw || 'Sem descrição',
          amount: Math.abs(tx.amount),
          type: tx.amount >= 0 ? 'income' : 'expense',
          date: tx.date,
          wallet_id: walletId,
          status: 'pending',
        });
        
        if (error) console.error(`[SYNC] Insert error: ${error.message}`);
        else totalInserted++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: totalInserted, skipped: totalSkipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SYNC] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
