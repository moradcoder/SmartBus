const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://npdkyeeifxolnpkzvxur.supabase.co";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "No service role key found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const users = [
      { email: "customer@smartbus.ma", password: "SmartBus2026!", fullName: "Ahmed Customer", role: "customer" },
      { email: "driver@smartbus.ma", password: "SmartBus2026!", fullName: "Mohamed Alami", role: "driver" },
      { email: "admin@smartbus.ma", password: "SmartBus2026!", fullName: "Admin Manager", role: "admin" },
    ];

    const results: Array<Record<string, unknown>> = [];

    // First, list existing users via GoTrue admin API
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
    });
    const listData = await listRes.json();
    const existingUsers = listData?.users || [];

    for (const user of users) {
      const existing = existingUsers.find((u: { email?: string }) => u.email === user.email);

      if (existing) {
        // Update user via GoTrue admin API
        const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${existing.id}`, {
          method: "PUT",
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: user.password,
            email_confirm: true,
          }),
        });
        const updateData = await updateRes.json();
        if (!updateRes.ok) {
          results.push({ email: user.email, status: "update_error", error: JSON.stringify(updateData) });
        } else {
          // Update profile role via REST API
          let driverId = null;
          if (user.role === "driver") {
            const drvRes = await fetch(`${supabaseUrl}/rest/v1/drivers?name=eq.محمد العلوي&select=id&limit=1`, {
              headers: {
                "apikey": serviceRoleKey,
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
            });
            const drvData = await drvRes.json();
            driverId = drvData?.[0]?.id || null;
          }
          await fetch(`${supabaseUrl}/rest/v1/user_profiles`, {
            method: "POST",
            headers: {
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              "Prefer": "resolution=merge-duplicates",
            },
            body: JSON.stringify({
              id: existing.id,
              email: user.email,
              full_name: user.fullName,
              role: user.role,
              driver_id: driverId,
            }),
          });
          results.push({ email: user.email, status: "updated", id: existing.id });
        }
      } else {
        // Create user via GoTrue admin API
        const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: { full_name: user.fullName },
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          results.push({ email: user.email, status: "create_error", error: JSON.stringify(createData), code: createRes.status });
        } else {
          // Create profile with correct role
          let driverId = null;
          if (user.role === "driver") {
            const drvRes = await fetch(`${supabaseUrl}/rest/v1/drivers?name=eq.محمد العلوي&select=id&limit=1`, {
              headers: {
                "apikey": serviceRoleKey,
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
            });
            const drvData = await drvRes.json();
            driverId = drvData?.[0]?.id || null;
          }
          await fetch(`${supabaseUrl}/rest/v1/user_profiles`, {
            method: "POST",
            headers: {
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              "Prefer": "resolution=merge-duplicates",
            },
            body: JSON.stringify({
              id: createData.id,
              email: user.email,
              full_name: user.fullName,
              role: user.role,
              driver_id: driverId,
            }),
          });
          results.push({ email: user.email, status: "created", id: createData.id });
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, stack: (err as Error).stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
