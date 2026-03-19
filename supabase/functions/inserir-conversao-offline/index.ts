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
    const token = req.headers.get("x-webhook-token");
    const expectedToken = Deno.env.get("WEBHOOK_SECRET");

    if (!token || token !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { empresa_id, conversion_name, gclid, conversion_time, conversion_value, conversion_currency, external_attribution_data } = body;

    if (!empresa_id || !conversion_name) {
      return new Response(
        JSON.stringify({ error: "empresa_id and conversion_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("conversoes_offline")
      .upsert({
        empresa_id,
        conversion_name,
        gclid: gclid || null,
        conversion_time: conversion_time || new Date().toISOString(),
        conversion_value: conversion_value ?? 0,
        conversion_currency: conversion_currency || "BRL",
        external_attribution_data: external_attribution_data || null,
      }, { onConflict: 'gclid,conversion_name' })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
