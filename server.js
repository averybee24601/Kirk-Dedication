const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

// Serve static assets (the site)
app.use(express.static(ROOT, {
  extensions: ['html']
}));

// Paths to original (as provided) and a compatibility H.264/AAC encode
const ORIGINAL_VIDEO_PATH = path.join(ROOT, 'videos', 'msnbc_compilation_final.mp4');
const H264_VIDEO_PATH = path.join(ROOT, 'videos', 'msnbc_compilation_final_h264.mp4');

// Robust download endpoint that forces attachment on all browsers
app.get('/download/video', (req, res) => {
  try {
    const variant = (req.query.variant || 'original').toLowerCase();
    const filePath = variant === 'h264' && fs.existsSync(H264_VIDEO_PATH)
      ? H264_VIDEO_PATH
      : ORIGINAL_VIDEO_PATH;

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Video not found');
    }

    const downloadName = variant === 'h264'
      ? 'MSNBC_Should_Lose_License_Evidence_mobile.mp4'
      : 'MSNBC_Should_Lose_License_Evidence.mp4';

    // res.download sets Content-Disposition: attachment and streams efficiently
    res.download(filePath, downloadName, (err) => {
      if (err && !res.headersSent) {
        // As a fallback, send the file with explicit headers
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.sendFile(filePath);
      }
    });
  } catch (e) {
    console.error('Download error:', e);
    res.status(500).send('Unable to process download');
  }
});

// Lightweight HEAD endpoint so client code can detect availability without triggering a download
app.head('/download/video', (req, res) => {
  try {
    const variant = (req.query.variant || 'original').toLowerCase();
    const filePath = variant === 'h264' && fs.existsSync(H264_VIDEO_PATH)
      ? H264_VIDEO_PATH
      : ORIGINAL_VIDEO_PATH;
    if (!fs.existsSync(filePath)) return res.sendStatus(404);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment');
    return res.sendStatus(200);
  } catch (e) {
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
