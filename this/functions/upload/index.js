export default async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('photo');

    if (!file || !file.name) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const objectKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    const accessKeyId = env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = env.OSS_ACCESS_KEY_SECRET;
    const bucket = env.OSS_BUCKET; // 格式: your-bucket.oss-cn-hangzhou.aliyuncs.com

    if (!accessKeyId || !accessKeySecret || !bucket) {
      return new Response(JSON.stringify({ error: 'OSS 环境变量未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const host = `https://${bucket}`;
    const ossUrl = `${host}/${objectKey}`;
    const date = new Date().toUTCString();
    const contentType = file.type || 'image/jpeg';
    const signatureString = `PUT\n\n${contentType}\n${date}\n/${bucket}/${objectKey}`;

    const encoder = new TextEncoder();
    const keyData = await crypto.subtle.importKey(
      'raw',
      encoder.encode(accessKeySecret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', keyData, encoder.encode(signatureString));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    const response = await fetch(ossUrl, {
      method: 'PUT',
      body: file.stream(),
      headers: {
        'Authorization': `OSS ${accessKeyId}:${signature}`,
        'Content-Type': contentType,
        'Date': date,
        'x-oss-storage-class': 'Standard'
      }
    });

    if (response.status === 200) {
      return new Response(JSON.stringify({ url: ossUrl }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    } else {
      const errorText = await response.text();
      throw new Error(`OSS upload failed: ${response.status} ${errorText}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
