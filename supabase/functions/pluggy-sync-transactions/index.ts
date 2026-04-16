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

    // Fetch automation rules for this user
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', userId);

    const apiKey = await getPluggyApiKey();
    const accounts = await fetchAccounts(apiKey, itemId);

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalAutoApproved = 0;

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
        const description = tx.description || tx.descriptionRaw || 'Sem descrição';
        const amount = Math.abs(tx.amount);
        const type = tx.amount >= 0 ? 'income' : 'expense';
        
        // Skip if exists in staged OR real transactions
        const { data: existingStaged } = await supabase
          .from('staged_transactions')
          .select('id, status, wallet_id')
          .eq('pluggy_transaction_id', pluggyTxId)
          .maybeSingle();

        // Also check if already consolidated in real transactions to avoid duplicates
        // Note: We might want a dedicated column for pluggy_id in transactions for better consistency
        // but for now we skip if it exists in staged.
        
        if (existingStaged) {
          // If it exists but not confirmed, update the mapping if it changed
          if (existingStaged.status !== 'confirmed' && existingStaged.wallet_id !== walletId) {
            await supabase
              .from('staged_transactions')
              .update({ wallet_id: walletId })
              .eq('id', existingStaged.id);
          }
          totalSkipped++; 
          continue; 
        }

        // Apply Automation Rules (Exact Match)
        const matchingRule = rules?.find(r => r.keyword?.toLowerCase() === description.toLowerCase());
        
        if (matchingRule?.rule_type === 'auto_approve' && matchingRule.category_id && walletId) {
          console.log(`[SYNC] AUTO-APPROVING: ${description}`);
          const { error: insertErr } = await supabase.from('transactions').insert({
            user_id: userId,
            description,
            amount,
            type,
            date: tx.date,
            category_id: matchingRule.category_id,
            wallet_id: walletId,
            status: 'paid',
            // If they also mapped a payment method in the auto-approve rule
            payment_method_id: matchingRule.payment_method_id || null
          });
          
          if (insertErr) {
             console.error(`[SYNC] Auto-approve error: ${insertErr.message}`);
             // Fallback to staged if auto-approve fails
          } else {
             // Create a "confirmed" record in staged to keep track that we synced this ID
             await supabase.from('staged_transactions').insert({
               user_id: userId,
               pluggy_transaction_id: pluggyTxId,
               pluggy_account_id: accountId,
               description,
               amount,
               type,
               date: tx.date,
               wallet_id: walletId,
               status: 'confirmed',
               suggested_category_id: matchingRule.category_id
             });
             
             totalAutoApproved++;
             continue;
          }
        }

        // Normal Staging or Suggestion mapping
        const { error } = await supabase.from('staged_transactions').insert({
          user_id: userId,
          pluggy_transaction_id: pluggyTxId,
          pluggy_account_id: accountId,
          description,
          amount,
          type,
          date: tx.date,
          wallet_id: walletId,
          status: 'pending',
          suggested_category_id: matchingRule?.category_id || null,
          payment_method_id: matchingRule?.payment_method_id || null
        });
        
        if (error) console.error(`[SYNC] Insert error: ${error.message}`);
        else totalInserted++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: totalInserted, skipped: totalSkipped, autoApproved: totalAutoApproved }),
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
