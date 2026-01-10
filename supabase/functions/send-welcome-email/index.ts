import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, welcomeEmailTemplate } from '../_shared/resend.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_email, display_name } = await req.json();

    if (!user_email) {
      return new Response(
        JSON.stringify({ error: 'user_email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { html, text } = welcomeEmailTemplate(user_email, display_name);

    await sendEmail({
      to: user_email,
      subject: 'Welcome to Foundry Lab',
      html,
      text,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Welcome email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
