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

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const objectKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    // 从环境变量读取 OSS 配置
    const accessKeyId = env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = env.OSS_ACCESS_KEY_SECRET;
    const bucket = env.OSS_BUCKET; // 格式: your-bucket.oss-cn-hangzhou.aliyuncs.com

    if (!accessKeyId || !accessKeySecret || !bucket) {
      return new Response(JSON.stringify({ error: 'OSS 环境变量未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // 构建 OSS 请求 URL
    const host = `https://${bucket}`;
    const ossUrl = `${host}/${objectKey}`;

    // --- 使用 OSS Signature V2 ---
    const now = new Date();
    const xOssDate = now.toISOString().replace(/\.\d{3}Z$/, 'Z'); // 格式: 2024-01-01T00:00:00Z
    const contentType = file.type || 'image/jpeg';

    // 构建签名字符串 (V2)
    const signatureString = [
      'PUT',
      '',           // Content-MD5，留空
      contentType,  // Content-Type
      '',           // Headers（这里不指定额外签名头）
      '/' + bucket + '/' + objectKey
    ].join('\n');

    // 生成签名密钥: HMAC-SHA256，派生两次
    const encoder = new TextEncoder();
    
    // 第一次派生：用 Secret 生成日期密钥
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
      encoder.encode(now.toISOString().slice(0, 10)) // 日期部分: YYYY-MM-DD
    );
    
    // 第二次派生：用日期密钥生成最终签名
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

    // 构造 OSS V2 认证头
    const authorization = `OSS2 ${accessKeyId}:${signature}`;

    // 上传到 OSS
    const response = await fetch(ossUrl, {
      method: 'PUT',
      body: file.stream(),
      headers: {
        'Authorization': authorization,
        'Content-Type': contentType,
        'x-oss-date': xOssDate,
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
