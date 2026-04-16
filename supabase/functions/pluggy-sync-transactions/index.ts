import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Origin': '*',
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

    // Check if item exists
    const { data: itemConnections, error: connError } = await supabase
      .from('pluggy_connections')
      .select('id, pluggy_account_id, wallet_id')
      .eq('pluggy_item_id', itemId)
      .eq('user_id', userId);

    if (connError || !itemConnections || itemConnections.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Item not mapped.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const activeAcountIds = itemConnections.map(c => c.pluggy_account_id);

    // FORCE MODE: Clear pending staged transactions
    if (force === true) {
      await supabase
        .from('staged_transactions')
        .delete()
        .eq('user_id', userId)
        .eq('status', 'pending')
        .in('pluggy_account_id', activeAcountIds);
    }

    const from = fromDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();

    const to = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];

    // Fetch automation rules
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
      const accountType = account.type; // 'CHECKING', 'CREDIT', etc.

      const connectionMapping = itemConnections.find(c => c.pluggy_account_id === accountId);
      if (!connectionMapping) continue;

      const walletId = connectionMapping.wallet_id || null;
      const transactions = await fetchTransactions(apiKey, accountId, from, to);

      for (const tx of transactions) {
        const pluggyTxId = tx.id;
        const description = tx.description || tx.descriptionRaw || 'Sem descrição';
        const amount = Math.abs(tx.amount);
        
        // --- NEW LOGIC: Correct Classification ---
        // For CREDIT accounts, Pluggy often returns purchases (expenses) as POSITIVE values.
        // For CHECKING accounts, expenses are usually NEGATIVE.
        // So we normalize:
        let type: 'income' | 'expense' = 'expense';
        if (accountType === 'CREDIT') {
          // If Credit Card: Usually Positive = Purchase (Expense), Negative = Payment/Refund (Income)
          type = tx.amount >= 0 ? 'expense' : 'income';
        } else {
          // If Checking: Usual Negative = Money Out (Expense), Positive = Money In (Income)
          type = tx.amount >= 0 ? 'income' : 'expense';
        }

        // Special case: If description contains "Estorno" or "Devolução", it's likely income
        if (description.toLowerCase().includes('estorno') || description.toLowerCase().includes('devolução')) {
          type = 'income';
        }

        // Skip if exists
        const { data: existingStaged } = await supabase
          .from('staged_transactions')
          .select('id, status, wallet_id')
          .eq('pluggy_transaction_id', pluggyTxId)
          .maybeSingle();
        
        if (existingStaged) {
          if (existingStaged.status !== 'approved' && existingStaged.wallet_id !== walletId) {
            await supabase.from('staged_transactions').update({ wallet_id: walletId }).eq('id', existingStaged.id);
          }
          totalSkipped++; 
          continue; 
        }

        const matchingRule = rules?.find(r => r.keyword?.toLowerCase() === description.toLowerCase());
        
        if (matchingRule?.rule_type === 'auto_approve' && matchingRule.category_id && walletId) {
          const { error: insertErr } = await supabase.from('transactions').insert({
            user_id: userId,
            description,
            amount,
            type,
            date: tx.date,
            category_id: matchingRule.category_id,
            wallet_id: walletId,
            status: 'paid',
            payment_method_id: matchingRule.payment_method_id || null
          });
          
          if (!insertErr) {
             await supabase.from('staged_transactions').insert({
               user_id: userId,
               pluggy_transaction_id: pluggyTxId,
               pluggy_account_id: accountId,
               description,
               amount,
               type,
               date: tx.date,
               wallet_id: walletId,
               status: 'approved',
               suggested_category_id: matchingRule.category_id
             });
             totalAutoApproved++;
             continue;
          }
        }

        await supabase.from('staged_transactions').insert({
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
        
        totalInserted++;
      }
    }

    return new Response(JSON.stringify({ success: true, inserted: totalInserted, skipped: totalSkipped, autoApproved: totalAutoApproved }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});
