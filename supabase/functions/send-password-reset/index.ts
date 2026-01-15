import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, passwordResetEmailTemplate } from '../_shared/resend.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_email, reset_link } = await req.json();

    if (!user_email || !reset_link) {
      return new Response(
        JSON.stringify({ error: 'user_email and reset_link are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { html, text } = passwordResetEmailTemplate(reset_link, '1 hour');

    await sendEmail({
      to: user_email,
      subject: 'Reset your Foundry Lab password',
      html,
      text,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Password reset email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
