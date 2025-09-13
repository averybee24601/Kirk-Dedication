const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const MEDIA_BASE = 'https://media.githubusercontent.com/media/averybee24601/Kirk-Dedication/main/';

// Health check
app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));

// If a requested video is missing locally (likely due to Git LFS pointers on deploy),
// redirect to the GitHub media host which serves the real binary.
app.get(/^\/videos\/(.+\.mp4)$/i, (req, res, next) => {
  try {
    const rel = req.params[0];
    const localPath = path.join(ROOT, 'videos', rel);

    // Check if file exists and is not a Git LFS pointer
    fs.readFile(localPath, (err, data) => {
      if (err) {
        // File doesn't exist, redirect to GitHub media
        const remoteRel = path.posix.join('videos', rel.split('\\').join('/'));
        const remote = MEDIA_BASE + remoteRel.split('/').map(encodeURIComponent).join('/');
        return res.redirect(302, remote);
      }

      // Check if this is a Git LFS pointer file (starts with "version https://git-lfs.github.com/spec/v1")
      const isLfsPointer = data.toString().startsWith('version https://git-lfs.github.com/spec/v1');

      if (isLfsPointer || data.length < 1000000) { // Also redirect if suspiciously small for a video
        const remoteRel = path.posix.join('videos', rel.split('\\').join('/'));
        const remote = MEDIA_BASE + remoteRel.split('/').map(encodeURIComponent).join('/');
        return res.redirect(302, remote);
      }

      // File exists and appears to be a real video file, serve it normally
      return next();
    });
  } catch (e) {
    return next();
  }
});

// Serve static assets (the site)
app.use(express.static(ROOT, {
  extensions: ['html'],
  setHeaders: (res, path) => {
    if (path.endsWith('.mp4')) {
      // Ensure proper headers for video files
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp4');
    }
  }
}));

// Current canonical video file (H.264/AAC compatible)
const CURRENT_VIDEO_FILE = 'msnbc_compilation_final (4).mp4';
const REMOTE_FALLBACKS = [
  'videos/msnbc_compilation_final (4).mp4',
  'videos/msnbc_compilation_final_h264.mp4',
  'videos/msnbc_compilation_final.mp4'
];
// Paths to original (as provided) and a compatibility H.264/AAC encode
const ORIGINAL_VIDEO_PATH = path.join(ROOT, 'videos', CURRENT_VIDEO_FILE);
const H264_VIDEO_PATH = ORIGINAL_VIDEO_PATH;

// Robust download endpoint that forces attachment on all browsers
app.get('/download/video', (req, res) => {
  try {
    const variant = (req.query.variant || 'original').toLowerCase();
    const filePath = variant === 'h264' && fs.existsSync(H264_VIDEO_PATH)
      ? H264_VIDEO_PATH
      : ORIGINAL_VIDEO_PATH;

    if (!fs.existsSync(filePath)) {
      // Fallback: redirect to available remote candidate
      (async () => {
        for (const rel of REMOTE_FALLBACKS) {
          try {
            const url = MEDIA_BASE + rel.split('/').map(encodeURIComponent).join('/');
            const head = await fetch(url, { method: 'HEAD' });
            if (head.ok) return res.redirect(302, url);
          } catch (_) {}
        }
        return res.status(404).send('Video not found');
      })();
      return;
    }

    // If the file looks like a Git LFS pointer, redirect to media host as well
    try {
      const stat = fs.statSync(filePath);
      if (stat.size < 1000000) {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(Math.min(200, stat.size));
        fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const isLfs = buf.toString().startsWith('version https://git-lfs.github.com/spec/v1');
        if (isLfs) {
          (async () => {
            for (const rel of REMOTE_FALLBACKS) {
              try {
                const url = MEDIA_BASE + rel.split('/').map(encodeURIComponent).join('/');
                const head = await fetch(url, { method: 'HEAD' });
                if (head.ok) return res.redirect(302, url);
              } catch (_) {}
            }
            return res.status(404).send('Video not available');
          })();
          return;
        }
      }
    } catch (_) {}

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

// Inline streaming endpoint that supports Range requests and serves H.264/AAC when available
app.get('/stream/video', async (req, res) => {
  try {
    const variant = (req.query.variant || 'h264').toLowerCase();
    const filePath = variant === 'h264' ? H264_VIDEO_PATH : ORIGINAL_VIDEO_PATH;
    const range = req.headers.range;

    const serveLocal = () => {
      try {
        const stat = fs.statSync(filePath);
        const total = stat.size;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'inline');
        if (range) {
          const match = /bytes=(\d+)-(\d+)?/.exec(range);
          const start = match ? parseInt(match[1], 10) : 0;
          const end = match && match[2] ? parseInt(match[2], 10) : total - 1;
          const chunkSize = end - start + 1;
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
          res.setHeader('Content-Length', chunkSize);
          return fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.setHeader('Content-Length', total);
          return fs.createReadStream(filePath).pipe(res);
        }
      } catch (e) {
        return false;
      }
    };

    // If local file is present and not an LFS pointer (rough check), stream it
    let usedLocal = false;
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.size >= 1000000) {
          serveLocal();
          usedLocal = true;
        } else {
          const fd = fs.openSync(filePath, 'r');
          const buf = Buffer.alloc(Math.min(200, stat.size));
          fs.readSync(fd, buf, 0, buf.length, 0);
          fs.closeSync(fd);
          const isLfs = buf.toString().startsWith('version https://git-lfs.github.com/spec/v1');
          if (!isLfs) {
            serveLocal();
            usedLocal = true;
          }
        }
      }
    } catch (_) {}

    if (usedLocal) return;

    // Otherwise proxy from GitHub media with inline disposition and Range passthrough
    const remoteRel = `videos/${CURRENT_VIDEO_FILE}`;
    const remote = MEDIA_BASE + remoteRel.split('/').map(encodeURIComponent).join('/');

    const headers = {};
    if (range) headers['Range'] = range;

    const response = await fetch(remote, { headers });
    if (!response.ok && response.status !== 206) {
      return res.sendStatus(response.status);
    }

    // Forward relevant headers but force inline playback
    res.status(response.status);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline');
    const cl = response.headers.get('content-length');
    const cr = response.headers.get('content-range');
    if (cl) res.setHeader('Content-Length', cl);
    if (cr) res.setHeader('Content-Range', cr);

    const { Readable } = require('stream');
    const body = response.body;
    if (body && typeof body.pipe === 'function') {
      body.pipe(res);
    } else if (body) {
      Readable.fromWeb(body).pipe(res);
    } else {
      res.end();
    }
  } catch (e) {
    res.sendStatus(500);
  }
});
