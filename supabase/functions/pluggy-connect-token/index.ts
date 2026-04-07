const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
    const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("Missing Pluggy credentials in environment variables.");
    }

    const { clientUserId, itemId } = await req.json().catch(() => ({}));
    
    // 1. Authenticate with Pluggy
    const authResponse = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        clientSecret,
      }),
    });

    if (!authResponse.ok) {
      const errText = await authResponse.text();
      console.error("[DEBUG: PLUGGY AUTH ERRO]", errText);
      throw new Error(`Failed to authenticate with Pluggy: ${errText}`);
    }

    const authData = await authResponse.json();
    const apiKey = authData.apiKey;

    // 2. Generate Connect Token
    const connectTokenPayload: any = {
      clientUserId: clientUserId || undefined,
    };

    // Fix: Only attach itemId if it's a valid string UUID
    if (itemId && typeof itemId === "string" && itemId.trim() !== "") {
      connectTokenPayload.itemId = itemId.trim();
    }

    const connectTokenResponse = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(connectTokenPayload),
    });

    if (!connectTokenResponse.ok) {
      const errText = await connectTokenResponse.text();
      console.error("[DEBUG: PLUGGY CONNECT TOKEN ERRO]", errText);
      throw new Error(`Failed to create connect token: ${errText}`);
    }

    const connectData = await connectTokenResponse.json();

    return new Response(
      JSON.stringify({ accessToken: connectData.accessToken }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating connect token:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
