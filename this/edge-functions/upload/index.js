export default async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('photo');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const objectKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    // Store in OSS
    const ossUrl = `https://${MY_OSS_BUCKET_NAME}.${MY_OSS_REGION}.aliyuncs.com`;
    const response = await fetch(`${ossUrl}/${objectKey}`, {
      method: 'PUT',
      body: file.stream(),
      headers: {
        'Authorization': `OSS ${MY_OSS_ACCESS_KEY_ID}:${signature}`,
        'Content-Type': file.type || 'image/jpeg',
        'x-oss-storage-class': 'Standard'
      }
    });

    if (response.status === 200) {
      return new Response(JSON.stringify({ url: `${ossUrl}/${objectKey}` }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error(`OSS upload failed: ${response.status}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}