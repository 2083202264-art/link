export default async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('photo');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const objectKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    // 从环境变量获取 OSS 配置
    const bucket = env.OSS_BUCKET; // 格式: your-bucket-name.oss-cn-hangzhou.aliyuncs.com
    const host = `https://${bucket}`;
    const accessKeyId = env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = env.OSS_ACCESS_KEY_SECRET;

    if (!bucket || !accessKeyId || !accessKeySecret) {
      return new Response(JSON.stringify({ error: 'OSS 环境变量未配置' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 生成 OSS 鉴权签名 (Signature V1)
    const date = new Date().toUTCString();
    const signatureString = `PUT\n\n${file.type || 'image/jpeg'}\n${date}\n/${bucket}/${objectKey}`;
    const encoder = new TextEncoder();
    const keyData = await crypto.subtle.importKey(
      'raw', encoder.encode(accessKeySecret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', keyData, encoder.encode(signatureString));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // 上传到 OSS
    const ossUrl = `${host}/${objectKey}`;
    const response = await fetch(ossUrl, {
      method: 'PUT',
      body: file.stream(),
      headers: {
        'Authorization': `OSS ${accessKeyId}:${signature}`,
        'Content-Type': file.type || 'image/jpeg',
        'Date': date,
        'x-oss-storage-class': 'Standard'
      }
    });

    if (response.status === 200) {
      return new Response(JSON.stringify({ url: ossUrl }), { headers: { 'Content-Type': 'application/json' } });
    } else {
      throw new Error(`OSS upload failed with status: ${response.status}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
