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
    const bucket = env.OSS_BUCKET;

    if (!accessKeyId || !accessKeySecret || !bucket) {
      return new Response(JSON.stringify({ error: 'OSS 环境变量未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const date = new Date().toUTCString();
    const contentType = file.type || 'image/jpeg';

    // 构建签名串
    const signatureString = `PUT\n\n${contentType}\n${date}\n/${bucket}/${objectKey}`;

    // 计算签名
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

    // ========== 调试：返回签名信息，暂不上传 ==========
    return new Response(JSON.stringify({
      debug: true,
      accessKeyId: accessKeyId,
      bucket: bucket,
      objectKey: objectKey,
      date: date,
      contentType: contentType,
      signatureString: signatureString,
      signature: signature,
      expectedUrl: `https://${bucket}/${objectKey}`
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
