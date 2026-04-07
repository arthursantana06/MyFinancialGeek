import { PluggyClient } from "npm:pluggy-sdk";

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

    const pluggy = new PluggyClient({
      clientId,
      clientSecret,
    });

    const body = await req.json();
    const { clientUserId } = body;

    const connectToken = await pluggy.createConnectToken({
      clientUserId,
    });

    return new Response(
      JSON.stringify({ accessToken: connectToken.accessToken }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating connect token:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
