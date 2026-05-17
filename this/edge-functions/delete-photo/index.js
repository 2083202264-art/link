export default async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const objectKey = url.searchParams.get('filename');

  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!objectKey) {
    return new Response(JSON.stringify({ error: 'Missing filename' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const ossUrl = `https://${MY_OSS_BUCKET_NAME}.${MY_OSS_REGION}.aliyuncs.com`;
    const response = await fetch(`${ossUrl}/${objectKey}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `OSS ${MY_OSS_ACCESS_KEY_ID}:${signature}`,
        'x-oss-date': new Date().toUTCString()
      }
    });

    if (response.status === 204) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error(`OSS delete failed: ${response.status}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}