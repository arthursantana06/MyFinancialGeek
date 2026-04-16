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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { itemId, userId, institutionName } = await req.json();
    if (!itemId || !userId) throw new Error('itemId and userId are required');

    const apiKey = await getPluggyApiKey();
    const res = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, {
      headers: { 'X-API-KEY': apiKey },
    });
    
    if (!res.ok) throw new Error(`Failed to fetch accounts: ${await res.text()}`);
    const data = await res.json();
    const accounts = data.results || [];

    // --- NEW LOGIC: Manage Banks Table ---
    // 1. Check if bank exists for this institution and user
    let bankId: string | null = null;
    const { data: existingBank } = await supabase
      .from('banks')
      .select('id')
      .eq('name', institutionName)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingBank) {
      bankId = existingBank.id;
    } else {
      // Create the bank automatically
      const { data: newBank, error: bankErr } = await supabase
        .from('banks')
        .insert({
          name: institutionName,
          user_id: userId,
          color: accounts[0]?.type === 'CREDIT' ? '#8b5cf6' : '#3b82f6' // Default logic
        })
        .select('id')
        .single();
      
      if (bankErr) console.error('[SYNC-ACCOUNTS] Bank creation error:', bankErr.message);
      else bankId = newBank.id;
    }

    const stats = { created: 0, updated: 0 };

    for (const account of accounts) {
      const type = account.type === 'CREDIT' ? 'credit_card' : 'checking';
      
      let credit_limit = null;
      let closing_day = null;
      let due_day = null;

      if (account.creditData) {
        credit_limit = account.creditData.creditLimit || null;
        if (account.creditData.balanceCloseDate) {
          const closeDate = new Date(account.creditData.balanceCloseDate);
          closing_day = closeDate.getUTCDate();
        }
        if (account.creditData.balanceDueDate) {
          const dueDate = new Date(account.creditData.balanceDueDate);
          due_day = dueDate.getUTCDate();
        }
      }

      // Check if connection already exists
      const { data: existingConn } = await supabase
        .from('pluggy_connections')
        .select('id, wallet_id')
        .eq('pluggy_account_id', account.id)
        .eq('user_id', userId)
        .maybeSingle();

      let walletId = existingConn?.wallet_id;

      if (walletId) {
        // Update existing wallet
        await supabase.from('wallets').update({
          bank_id: bankId, // Ensure it is linked to the bank
          credit_limit: credit_limit ?? undefined,
          closing_day: closing_day ?? undefined,
          due_day: due_day ?? undefined,
          institution_name: institutionName
        }).eq('id', walletId);
        
        await supabase.from('pluggy_connections').update({
          pluggy_account_name: account.name,
          pluggy_account_number: account.number,
          institution_name: institutionName
        }).eq('id', existingConn.id);
        
        stats.updated++;
      } else {
        // Create new wallet
        const { data: newWallet, error: walletErr } = await supabase.from('wallets').insert({
          user_id: userId,
          bank_id: bankId,
          name: account.name || 'Nova Conta',
          type,
          color: account.type === 'CREDIT' ? '#8b5cf6' : '#3b82f6',
          balance: type === 'checking' ? (account.balance || 0) : 0,
          include_in_total: true,
          credit_limit,
          closing_day,
          due_day,
          institution_name: institutionName
        }).select('id').single();

        if (walletErr) throw new Error(`Wallet insert error: ${walletErr.message}`);
        walletId = newWallet.id;

        // Create connection
        await supabase.from('pluggy_connections').insert({
          user_id: userId,
          pluggy_item_id: itemId,
          pluggy_account_id: account.id,
          wallet_id: walletId,
          institution_name: institutionName,
          pluggy_account_name: account.name,
          pluggy_account_type: account.type,
          pluggy_account_number: account.number
        });
        
        stats.created++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, accounts: accounts.length, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SYNC-ACCOUNTS] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
