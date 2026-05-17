export default async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const objectKey = url.searchParams.get('filename');

  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  if (!objectKey) {
    return new Response(JSON.stringify({ error: 'Missing filename' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // 从环境变量获取 OSS 配置
    const bucket = env.OSS_BUCKET;
    const accessKeyId = env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = env.OSS_ACCESS_KEY_SECRET;

    if (!bucket || !accessKeyId || !accessKeySecret) {
      return new Response(JSON.stringify({ error: 'OSS 环境变量未配置' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 生成 OSS 鉴权签名 (Signature V1)
    const date = new Date().toUTCString();
    const signatureString = `DELETE\n\n\n${date}\n/${bucket}/${objectKey}`;
    const encoder = new TextEncoder();
    const keyData = await crypto.subtle.importKey(
      'raw', encoder.encode(accessKeySecret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', keyData, encoder.encode(signatureString));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // 从 OSS 删除文件
    const ossUrl = `https://${bucket}/${objectKey}`;
    const response = await fetch(ossUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `OSS ${accessKeyId}:${signature}`,
        'Date': date
      }
    });

    if (response.status === 204) {
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } else {
      throw new Error(`OSS delete failed with status: ${response.status}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
