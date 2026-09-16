import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[VAPID] Generating new VAPID key pair...');
    
    // Generate ECDSA P-256 key pair for VAPID
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    // Export keys
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    // Convert JWK to URL-safe base64 format for Web Push
    // Public key needs to be in uncompressed point format (65 bytes: 0x04 + 32 bytes x + 32 bytes y)
    const x = base64UrlToUint8Array(publicKeyJwk.x!);
    const y = base64UrlToUint8Array(publicKeyJwk.y!);
    
    const publicKeyBytes = new Uint8Array(65);
    publicKeyBytes[0] = 0x04; // Uncompressed point indicator
    publicKeyBytes.set(x, 1);
    publicKeyBytes.set(y, 33);
    
    const publicKey = uint8ArrayToBase64Url(publicKeyBytes);
    const privateKey = privateKeyJwk.d!; // Private key is just the 'd' component

    console.log('[VAPID] Keys generated successfully');
    console.log('[VAPID] Public key length:', publicKey.length);

    return new Response(
      JSON.stringify({
        publicKey,
        privateKey,
        instructions: {
          step1: 'Add VITE_VAPID_PUBLIC_KEY to your .env or secrets with the publicKey value',
          step2: 'Add VAPID_PRIVATE_KEY to your edge function secrets with the privateKey value',
          step3: 'The keys are now ready for Web Push notifications'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    console.error('[VAPID] Error generating keys:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
