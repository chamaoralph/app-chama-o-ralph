import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook token
    const token = req.headers.get("x-webhook-token");
    const expectedToken = Deno.env.get("GOOGLE_ADS_WEBHOOK_TOKEN");

    if (!token || token !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { empresa_id, metrics } = await req.json();

    if (!empresa_id || !Array.isArray(metrics) || metrics.length === 0) {
      return new Response(
        JSON.stringify({ error: "empresa_id and metrics array are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert metrics
    const rows = metrics.map((m: any) => ({
      empresa_id,
      data: m.data,
      cost_micros: m.cost_micros ?? 0,
      clicks: m.clicks ?? 0,
      impressions: m.impressions ?? 0,
      conversions: m.conversions ?? 0,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("google_ads_metrics")
      .upsert(rows, { onConflict: "empresa_id,data" });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, upserted: rows.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
