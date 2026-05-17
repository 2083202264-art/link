export default async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const objectKey = url.searchParams.get('filename');

  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  if (!objectKey) {
    return new Response(JSON.stringify({ error: 'Missing filename' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  try {
    const accessKeyId = env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = env.OSS_ACCESS_KEY_SECRET;
    const bucket = env.OSS_BUCKET;

    if (!accessKeyId || !accessKeySecret || !bucket) {
      return new Response(JSON.stringify({ error: 'OSS 环境变量未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const host = `https://${bucket}`;
    const ossUrl = `${host}/${objectKey}`;

    // --- OSS Signature V2 ---
    const now = new Date();
    const xOssDate = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    // V2 签名字符串
    const signatureString = [
      'DELETE',
      '',           // Content-MD5 留空
      '',           // Content-Type 留空（DELETE 无内容）
      '',           // Headers（无额外签名头）
      '/' + bucket + '/' + objectKey
    ].join('\n');

    const encoder = new TextEncoder();
    
    const dateKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(accessKeySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const dateSignature = await crypto.subtle.sign(
      'HMAC',
      dateKey,
      encoder.encode(now.toISOString().slice(0, 10))
    );
    
    const finalKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(dateSignature),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      finalKey,
      encoder.encode(signatureString)
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    const authorization = `OSS2 ${accessKeyId}:${signature}`;

    const response = await fetch(ossUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': authorization,
        'x-oss-date': xOssDate
      }
    });

    if (response.status === 204) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    } else {
      const errorText = await response.text();
      throw new Error(`OSS delete failed: ${response.status} ${errorText}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
