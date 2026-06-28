import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.json({ results: [] });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return res.json({
      results: [],
      message: 'YouTube API key is not configured'
    });
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        type: 'video',
        q: query,
        maxResults: 10,
        key: process.env.YOUTUBE_API_KEY
      }
    });

    const results = (response.data.items || []).map((item) => ({
      id: item.id?.videoId,
      title: item.snippet?.title,
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      channelTitle: item.snippet?.channelTitle
    })).filter((item) => item.id);

    return res.json({ results });
  } catch (error) {
    return res.status(502).json({
      results: [],
      error: 'YouTube search failed',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

export default router;
