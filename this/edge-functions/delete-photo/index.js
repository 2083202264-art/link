export default async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const objectKey = url.searchParams.get('filename');

  // 只接受 DELETE 请求
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

    // 构建 OSS 删除请求 URL
    const host = `https://${bucket}`;
    const ossUrl = `${host}/${objectKey}`;

    // 生成阿里云 OSS 鉴权签名 (Signature V1)
    const date = new Date().toUTCString();
    const signatureString = `DELETE\n\n\n${date}\n/${bucket}/${objectKey}`;
    
    // 使用 Web Crypto API 计算 HMAC-SHA1 签名
    const encoder = new TextEncoder();
    const keyData = await crypto.subtle.importKey(
      'raw',
      encoder.encode(accessKeySecret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      keyData,
      encoder.encode(signatureString)
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // 执行删除请求
    const response = await fetch(ossUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `OSS ${accessKeyId}:${signature}`,
        'Date': date
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
