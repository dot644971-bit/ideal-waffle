import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/playlist?playlistId=PLxxx&pageToken=xxx
 *
 * Server-side proxy for YouTube Data API v3 playlistItems.
 * Keeps the API key out of the browser bundle.
 * Set YOUTUBE_API_KEY in your Vercel environment variables.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playlistId = searchParams.get('playlistId');
  const pageToken = searchParams.get('pageToken') || '';

  if (!playlistId) {
    return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    part: 'snippet',
    playlistId,
    maxResults: '50',
    key: apiKey,
  });
  if (pageToken) params.set('pageToken', pageToken);

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'YouTube API error', details: err },
        { status: res.status }
      );
    }

    const data = await res.json();

    const episodes = (data.items || [])
      .filter((item: any) => item.snippet?.resourceId?.videoId)
      .map((item: any, idx: number) => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description || '',
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          `https://img.youtube.com/vi/${item.snippet.resourceId.videoId}/mqdefault.jpg`,
        position: item.snippet.position ?? idx,
      }));

    return NextResponse.json({
      episodes,
      nextPageToken: data.nextPageToken || null,
      totalResults: data.pageInfo?.totalResults ?? episodes.length,
    });
  } catch (err) {
    console.error('[/api/playlist] fetch error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
