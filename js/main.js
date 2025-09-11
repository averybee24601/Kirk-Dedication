// Main JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    
    // Video player functionality with mobile optimization
    const mainVideo = document.querySelector('.compilation-video');
    const playButtons = document.querySelectorAll('.play-clip');
    
    // Mobile device detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Video URL used across the site
    const LOCAL_VIDEO_URL = 'charlie kirk working video/f56830e5-22c2-4b3d-9dc2-e2c069934524 (2).mp4';

    // Fix Direct Link target
    const directLinkEl = document.getElementById('direct-link');
    if (directLinkEl) {
        directLinkEl.href = LOCAL_VIDEO_URL;
        directLinkEl.rel = 'noopener';
        directLinkEl.target = '_blank';
    }

    // Clean up mobile-fallback text and link
    const mobileFallback = document.querySelector('.mobile-fallback');
    if (mobileFallback) {
        const p = mobileFallback.querySelector('p');
        if (p) {
            p.textContent = "Mobile users: If the video doesn't load, use the Direct Link button below.";
        }
        const a = mobileFallback.querySelector('a');
        if (a) {
            a.href = LOCAL_VIDEO_URL;
            a.textContent = 'Open Video in New Tab';
            a.rel = 'noopener';
            a.target = '_blank';
        }
    }

    // Clean up mobile-fallback text and link
    const mobileFallback = document.querySelector('.mobile-fallback');
    if (mobileFallback) {
        const p = mobileFallback.querySelector('p');
        if (p) {
            p.textContent = "Mobile users: If the video doesn't load, use the Direct Link button below.";
        }
        const a = mobileFallback.querySelector('a');
        if (a) {
            a.href = LOCAL_VIDEO_URL;
            a.textContent = 'Open Video in New Tab';
            a.rel = 'noopener';
            a.target = '_blank';
        }
    }

    // Enhanced video loading with mobile-specific optimizations
    if (mainVideo) {
        // Ensure the browser aggressively fetches the video on all devices
        mainVideo.preload = 'auto';

        // Generate a clean thumbnail from the actual video frame
        generateDynamicPoster(mainVideo, { preferPlayThenPauseOnMobile: true });
        
        // Add mobile-specific attributes
        if (isMobile) {
            mainVideo.setAttribute('playsinline', '');
            mainVideo.setAttribute('webkit-playsinline', '');
        }
        
        // Optimize video playback settings (suppress noisy overlays on mobile)
        mainVideo.addEventListener('loadstart', function() {
            console.log('Loading compilation video');
            if (!isMobile) {
                showVideoStatus('Loading MSNBC evidence compilation...');
            }
        });
        
        mainVideo.addEventListener('loadedmetadata', function() {
            console.log('Video metadata loaded - preparing thumbnail');
            hideVideoStatus();
            generateDynamicPoster(mainVideo, { preferPlayThenPauseOnMobile: true });
        });
        
        // Desktop-only error recovery; mobile uses a simple fallback card
        if (!isMobile) {
            mainVideo.addEventListener('error', function() {
                console.log('Video loading failed');
                if (mainVideo.error) {
                    console.log('Video error details:', mainVideo.error);
                    const sources = mainVideo.querySelectorAll('source');
                    if (sources.length > 1) {
                        // Remove the failed source and reload
                        sources[0].remove();
                        mainVideo.load();
                        showVideoStatus('Trying backup video source...');
                    } else {
                        showVideoStatus('Click "Direct Link" or "Download" to access the video');
                    }
                }
            });
        }
        
        mainVideo.addEventListener('canplay', function() {
            console.log('Compilation video ready to play');
            hideVideoStatus();
        });
        
        mainVideo.addEventListener('canplaythrough', function() {
            console.log('Video fully loaded and ready');
            hideVideoStatus();
        });
        
        mainVideo.addEventListener('waiting', function() {
            console.log('Video buffering...');
            if (!isMobile) {
                showVideoStatus('Buffering video...');
            }
        });
        
        mainVideo.addEventListener('playing', function() {
            console.log('Video playing');
            hideVideoStatus();
        });
        
        if (isMobile) {
            mainVideo.addEventListener('error', function(e) {
                console.log('Video error:', e);
                handleMobileVideoError(mainVideo);
            });
        }
        
        mainVideo.addEventListener('loadeddata', function() {
            console.log('Video data loaded');
            hideVideoStatus();
            generateDynamicPoster(mainVideo, { preferPlayThenPauseOnMobile: true });
        });
        
        // Add buffer management (desktop only)
        if (!isMobile) {
            mainVideo.addEventListener('progress', function() {
                if (mainVideo.buffered.length > 0) {
                    const bufferedEnd = mainVideo.buffered.end(mainVideo.buffered.length - 1);
                    const duration = mainVideo.duration;
                    const bufferedPercent = (bufferedEnd / duration) * 100;
                    
                    if (bufferedPercent > 10) { // Once 10% is buffered
                        hideVideoStatus();
                    }
                }
            });
        }

        // Force immediate load on all devices
        try { mainVideo.load(); } catch (e) {}

        // Preload a few seconds to prevent initial lag when possible
        mainVideo.addEventListener('loadedmetadata', function() {
            if (mainVideo.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                mainVideo.currentTime = 0.1; // Preload first frame
                mainVideo.currentTime = 0;
            }
        });
    }
    
    // Create a poster image from the video itself for a clean thumbnail
    async function generateDynamicPoster(video, options = {}) {
        try {
            if (!video || video.dataset.posterGenerated === 'true') return;

            // Wait for metadata (dimensions)
            if (video.readyState < 1) {
                await new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once: true }));
            }

            const captureTimeSeconds = Math.min(1, (video.duration || 1) - 0.05);
            const previousTime = isNaN(video.currentTime) ? 0 : video.currentTime;

            // On iOS Safari, seeking without a play may not render frames. Do a brief muted play.
            const needMobileKick = /iPhone|iPad|iPod/i.test(navigator.userAgent) && options.preferPlayThenPauseOnMobile;
            if (needMobileKick) {
                try {
                    video.muted = true;
                    await video.play();
                    // Pause quickly after a tick so a frame is available
                    await new Promise(r => setTimeout(r, 120));
                    video.pause();
                } catch (e) {
                    // ignore; continue with best effort
                }
            }

            await new Promise(resolve => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                try {
                    video.addEventListener('seeked', onSeeked);
                    video.currentTime = captureTimeSeconds;
                } catch (e) {
                    resolve();
                }
            });

            const width = video.videoWidth || 1280;
            const height = video.videoHeight || 720;
            if (width && height) {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                video.setAttribute('poster', dataUrl);
                video.style.backgroundImage = `url(${dataUrl})`;
                video.style.backgroundSize = 'cover';
                video.style.backgroundPosition = 'center';
                video.dataset.posterGenerated = 'true';
            }

            // Restore original time without starting playback
            try {
                if (!isNaN(previousTime)) {
                    video.currentTime = previousTime;
                }
            } catch (e) {}
        } catch (e) {
            console.log('Thumbnail generation failed', e);
        }
    }

    // Mobile video error handler
    function handleMobileVideoError(video) {
        console.log('Mobile video error detected');
        showVideoStatus('Tap "Direct Link" below to access video');
        
        // Create mobile-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mobile-video-error';
        errorDiv.innerHTML = `
            <div style="
                background: rgba(255, 107, 107, 0.1);
                border: 2px solid #ff6b6b;
                padding: 20px;
                border-radius: 15px;
                text-align: center;
                margin: 15px 0;
                color: #ff6b6b;
            ">
                <h4 style="margin-bottom: 10px;">📱 Mobile Video Issue</h4>
                <p style="margin-bottom: 15px;">Use the "Direct Link" button below to view the video in your browser or download it.</p>
                <a href="${LOCAL_VIDEO_URL}" 
                   target="_blank" 
                   style="
                       background: #ff6b6b;
                       color: white;
                       padding: 12px 20px;
                       border-radius: 8px;
                       text-decoration: none;
                       display: inline-block;
                       font-weight: bold;
                   ">
                   🎥 Open Video in New Tab
                </a>
            </div>
        `;
        
        if (video.parentNode && !video.parentNode.querySelector('.mobile-video-error')) {
            video.parentNode.insertBefore(errorDiv, video.nextSibling);
        }
    }
    
    function showVideoStatus(message) {
        let statusDiv = document.querySelector('.video-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.className = 'video-status';
            statusDiv.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 15px 25px;
                border-radius: 10px;
                z-index: 10;
                font-size: 14px;
            `;
            mainVideo.parentNode.style.position = 'relative';
            mainVideo.parentNode.appendChild(statusDiv);
        }
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
    }
    
    function hideVideoStatus() {
        const statusDiv = document.querySelector('.video-status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    }
    
    // Handle clip timestamp navigation for compilation video
    playButtons.forEach(button => {
        button.addEventListener('click', function() {
            const timestamp = parseInt(this.getAttribute('data-time'));
            if (timestamp !== null && !isNaN(timestamp)) {
                // Get the main compilation video
                const mainVideo = document.querySelector('.compilation-video');
                if (mainVideo) {
                    // Set video time and play
                    mainVideo.currentTime = timestamp;
                    mainVideo.play();
                    
                    // Scroll to video
                    mainVideo.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }
                
                // Add visual feedback based on clip type
                const severity = this.parentNode.querySelector('.severity').classList;
                let feedbackColor = '#00ff00';
                let feedbackText = 'Playing...';
                
                if (severity.contains('critical')) {
                    feedbackColor = '#ff0000';
                    feedbackText = 'Playing Critical Evidence';
                } else if (severity.contains('high')) {
                    feedbackColor = '#ff9500';
                    feedbackText = 'Playing High Severity';
                } else if (severity.contains('response')) {
                    feedbackColor = '#00ff00';
                    feedbackText = 'Playing DeVory Response';
                }
                
                this.style.background = feedbackColor;
                this.textContent = feedbackText;
                
                setTimeout(() => {
                    this.style.background = '#ff6b6b';
                    this.textContent = 'Play Clip';
                }, 3000);
            }
        });
    });
    
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Impact meter animations
    const observerOptions = {
        threshold: 0.3,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const impactObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const meterFills = entry.target.querySelectorAll('.meter-fill');
                meterFills.forEach(fill => {
                    const width = fill.style.width;
                    fill.style.width = '0%';
                    setTimeout(() => {
                        fill.style.width = width;
                    }, 200);
                });
            }
        });
    }, observerOptions);
    
    // Observe all analysis cards
    document.querySelectorAll('.analysis-card').forEach(card => {
        impactObserver.observe(card);
    });
    
    // Timeline animation
    const timelineObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe timeline items
    document.querySelectorAll('.timeline-item').forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(50px)';
        item.style.transition = 'all 0.6s ease-out';
        timelineObserver.observe(item);
    });
    
    // Video error handling (desktop only)
    if (!isMobile) {
    document.querySelectorAll('video').forEach(video => {
        video.addEventListener('error', function() {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'video-error';
            errorMsg.innerHTML = `
                <div style="
                    background: rgba(255, 0, 0, 0.1);
                    border: 1px solid #ff0000;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    color: #ff0000;
                    margin: 10px 0;
                ">
                    <i class="fas fa-exclamation-triangle" style="margin-right: 10px;"></i>
                    Video temporarily unavailable. The evidence has been documented and archived.
                    <br><small>Contact administrators for direct access to source files.</small>
                </div>
            `;
            
            if (video.parentNode) {
                video.parentNode.insertBefore(errorMsg, video.nextSibling);
            }
        });
        
        video.addEventListener('loadstart', function() {
            // Remove any existing error messages when video starts loading
            const errorMsgs = video.parentNode.querySelectorAll('.video-error');
            errorMsgs.forEach(msg => msg.remove());
        });
    });
    }
    
    // Enhanced video loading with better error handling (desktop only)
    if (!isMobile) {
    document.querySelectorAll('video').forEach(video => {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'video-loading';
        loadingOverlay.innerHTML = `
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                padding: 20px;
                border-radius: 10px;
                color: white;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 10;
            ">
                <i class="fas fa-spinner fa-spin"></i>
                Loading evidence...
            </div>
        `;
        
        if (video.parentNode) {
            video.parentNode.style.position = 'relative';
            video.parentNode.appendChild(loadingOverlay);
        }
        
        // Remove loading overlay when video is ready
        video.addEventListener('canplaythrough', function() {
            if (loadingOverlay.parentNode) {
                loadingOverlay.remove();
            }
        });
        
        // Handle errors gracefully
        video.addEventListener('error', function() {
            if (loadingOverlay.parentNode) {
                loadingOverlay.innerHTML = `
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: rgba(255, 0, 0, 0.9);
                        padding: 20px;
                        border-radius: 10px;
                        color: white;
                        text-align: center;
                        z-index: 10;
                    ">
                        <i class="fas fa-exclamation-triangle"></i><br>
                        Evidence archived - Contact for access
                    </div>
                `;
            }
        });
        
        // Force load attempt
        video.load();
    });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Pause all videos on escape
            document.querySelectorAll('video').forEach(video => {
                video.pause();
            });
        }
        
        if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const mainVideo = document.querySelector('.compilation-video');
            if (mainVideo) {
                if (mainVideo.paused) {
                    mainVideo.play();
                } else {
                    mainVideo.pause();
                }
            }
        }
    });
    
    // Context menu disable for videos (optional protection)
    document.querySelectorAll('video').forEach(video => {
        video.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
    });
    
    // Track video engagement
    document.querySelectorAll('video').forEach((video, index) => {
        let played = false;
        video.addEventListener('play', function() {
            if (!played) {
                console.log(`Video ${index + 1} started playing`);
                played = true;
            }
        });
    });
    
    // Set website URL in the share section
    const urlInput = document.getElementById('websiteUrl');
    if (urlInput) {
        urlInput.value = window.location.href;
    }
    
    // Auto-pause other videos when one starts playing
    document.querySelectorAll('video').forEach(video => {
        video.addEventListener('play', function() {
            document.querySelectorAll('video').forEach(otherVideo => {
                if (otherVideo !== video) {
                    otherVideo.pause();
                }
            });
        });
    });
    
    // Video controls enhancement (disabled to fix layout issues)
    // Custom control panels removed to prevent overlay conflicts
    
    // Performance monitoring
    const performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
            if (entry.entryType === 'navigation') {
                console.log(`Page load time: ${entry.loadEventEnd - entry.loadEventStart}ms`);
            }
        });
    });
    
    if ('PerformanceObserver' in window) {
        performanceObserver.observe({ entryTypes: ['navigation'] });
    }
});

// Simple website link copying functionality
function copyWebsiteLink() {
    const urlInput = document.getElementById('websiteUrl');
    const currentUrl = window.location.href;
    
    // Set the current URL in the input
    urlInput.value = currentUrl;
    
    // Copy to clipboard
    navigator.clipboard.writeText(currentUrl).then(() => {
        const button = event.target;
        const originalContent = button.innerHTML;
        
        // Show success feedback
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.style.background = '#00ff00';
        
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.style.background = '#ff6b6b';
        }, 2000);
    }).catch(() => {
        // Fallback for browsers without clipboard API
        urlInput.select();
        document.execCommand('copy');
        
        const button = event.target;
        const originalContent = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.style.background = '#00ff00';
        
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.style.background = '#ff6b6b';
        }, 2000);
    });
}



// Additional utility functions
function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Timestamp display disabled to fix layout issues
// Absolute positioned overlays were causing sharing buttons to appear inside video area

// Video status functions
function showVideoStatus(message) {
    const statusElement = document.querySelector('.video-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.display = 'block';
    } else {
        console.log('Video Status:', message);
    }
}

function hideVideoStatus() {
    const statusElement = document.querySelector('.video-status');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}

// Video handling functions
function handleVideoLoad() {
    console.log('Video loading started');
    showVideoStatus('Loading MSNBC evidence compilation...');
    
    const video = document.querySelector('.compilation-video');
    if (video) {
        // Set video quality preferences
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        
        // Optimize for smooth playback
        if (video.readyState >= 2) {
            hideVideoStatus();
        }
    }
}

function handleVideoMetadata() {
    console.log('Video metadata loaded - thumbnail should appear');
    hideVideoStatus();
    
    const video = document.querySelector('.compilation-video');
    if (video && video.duration > 0) {
        // Generate thumbnail by seeking to 1 second then back
        const originalTime = video.currentTime;
        video.currentTime = Math.min(1, video.duration * 0.1);
        
        setTimeout(() => {
            video.currentTime = originalTime;
        }, 100);
    }
}

function handleVideoError() {
    console.log('Video loading failed');
    const video = document.querySelector('.compilation-video');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (video && video.error) {
        console.log('Video error details:', video.error);
        
        if (isMobile) {
            // Mobile-specific error handling
            showVideoStatus('Video loading failed on mobile. Try using the Direct Link.');
        } else {
            // Desktop error handling
            const sources = video.querySelectorAll('source');
            if (sources.length > 1) {
                // Remove the failed source and reload
                sources[0].remove();
                video.load();
                showVideoStatus('Trying backup video source...');
            } else {
                showVideoStatus('Click "Direct Link" or "Download" to access the video');
            }
        }
    }
}

function retryVideoLoad() {
    const video = document.querySelector('.compilation-video');
    if (video) {
        video.currentTime = 0;
        video.load();
        showVideoStatus('Reloading video...');
    }
}

// Console warning for protection
console.log(`
%c⚠️ EVIDENCE PROTECTION NOTICE ⚠️
%cThis website contains documented evidence of media bias.
All video content is protected and archived.
Any attempts to manipulate or alter this evidence will be logged.

For legitimate research purposes, contact the documentation team.
`, 'color: #ff0000; font-size: 16px; font-weight: bold;', 'color: #333; font-size: 12px;');

// Basic analytics (privacy-friendly)
if (typeof gtag !== 'undefined') {
    gtag('event', 'page_view', {
        page_title: 'MSNBC Media Bias Documentation',
        page_location: window.location.href
    });
}

// Service worker registration for offline access
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}

// Override mobile error handler with a clean, mobile-friendly version
function handleMobileVideoError(video) {
    try {
        const container = video && video.parentNode ? video.parentNode : document.body;
        if (!container || container.querySelector('.mobile-video-error')) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'mobile-video-error';
        errorDiv.style.background = 'rgba(255, 107, 107, 0.1)';
        errorDiv.style.border = '2px solid #ff6b6b';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '15px';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.margin = '15px 0';
        errorDiv.style.color = '#ff6b6b';

        const title = document.createElement('h4');
        title.style.marginBottom = '10px';
        title.textContent = 'Mobile Video Issue';

        const msg = document.createElement('p');
        msg.style.marginBottom = '15px';
        msg.textContent = 'Use the "Direct Link" below to view the video in your browser or download it.';

        const link = document.createElement('a');
        link.href = 'charlie kirk working video/f56830e5-22c2-4b3d-9dc2-e2c069934524 (2).mp4';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Open Video in New Tab';
        link.style.background = '#ff6b6b';
        link.style.color = 'white';
        link.style.padding = '12px 20px';
        link.style.borderRadius = '8px';
        link.style.textDecoration = 'none';
        link.style.display = 'inline-block';
        link.style.fontWeight = 'bold';

        errorDiv.appendChild(title);
        errorDiv.appendChild(msg);
        errorDiv.appendChild(link);

        container.insertBefore(errorDiv, video ? video.nextSibling : null);
    } catch (e) {
        console.log('Failed to render mobile error UI', e);
    }
}
