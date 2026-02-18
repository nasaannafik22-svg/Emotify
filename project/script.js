
// Variabel global
let faceapi = null;
let detectionInterval = null;
let isDetecting = false;
let isCameraOn = true;
let lastUpdateTime = 0;
let frameCount = 0;
let fps = 0;
let videoStream = null;
let lastEmotion = null;
let emotionStartTime = 0;
let stickerGenerated = false;

// Elemen DOM
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const loadingOverlay = document.getElementById("loadingOverlay");
const modelStatus = document.getElementById("modelStatus");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const toggleCameraBtn = document.getElementById("toggleCameraBtn");
const screenshotCameraBtn = document.getElementById("screenshotCameraBtn");
const screenshotResultBtn = document.getElementById("screenshotResultBtn");
const dominantEmotion = document.getElementById("dominantEmotion");
const detectionStatus = document.getElementById("detectionStatus");
const emotionBadges = document.getElementById("emotionBadges");
const emotionProgressBars = document.getElementById("emotionProgressBars");
const facesDetected = document.getElementById("facesDetected");
const detectionFPS = document.getElementById("detectionFPS");
const sensitivityRange = document.getElementById("sensitivityRange");
const frequencyRange = document.getElementById("frequencyRange");
const opacityRange = document.getElementById("opacityRange");
const detectionInfo = document.getElementById("detectionInfo");
const faceCount = document.getElementById("faceCount");

//Emot
const emotionStickers = {
    neutral: "/Emot/Neutral.png",
    happy: "/Emot/Happy.png",
    sad: "/Emot/Sad.png",
    angry: "/Emot/Angry.png",
    fearful: "/Emot/Fearful.png",
    disgusted: "/Emot/Disgusted.png",
    surprised: "/Emot/Suprised.png"
};

// Warna emosi untuk UI
const emotionColors = {
    neutral: { bg: "#6c757d", text: "white" },
    happy: { bg: "#198754", text: "white" },
    sad: { bg: "#0d6efd", text: "white" },
    angry: { bg: "#dc3545", text: "white" },
    fearful: { bg: "#ffc107", text: "black" },
    disgusted: { bg: "#6f42c1", text: "white" },
    surprised: { bg: "#fd7e14", text: "white" }
};

// Ikon emosi
const emotionIcons = {
    neutral: "fas fa-meh",
    happy: "fas fa-smile",
    sad: "fas fa-sad-tear",
    angry: "fas fa-angry",
    fearful: "fas fa-surprise",
    disgusted: "fas fa-grimace",
    surprised: "fas fa-surprise"
};

// Inisialisasi bar progres emosi
function initializeProgressBars() {
    emotionProgressBars.innerHTML = '';

    Object.keys(emotionColors).forEach(emotion => {
        const emotionName = emotion.charAt(0).toUpperCase() + emotion.slice(1);
        const progressBar = document.createElement('div');
        progressBar.className = 'mb-2';
        progressBar.innerHTML = `
                    <div class="d-flex justify-content-between">
                        <span><i class="${emotionIcons[emotion]} me-1"></i>${emotionName}</span>
                        <span id="${emotion}Percent">0%</span>
                    </div>
                    <div class="progress emotion-progress">
                        <div id="${emotion}Progress" class="progress-bar" role="progressbar" 
                            style="width: 0%; background-color: ${emotionColors[emotion].bg}">
                        </div>
                    </div>
                `;
        emotionProgressBars.appendChild(progressBar);
    });
}

// Perbarui tampilan emosi
function updateEmotionDisplay(expressions) {
    if (!expressions || expressions.length === 0) {
        dominantEmotion.textContent = "Tidak ada wajah terdeteksi";
        detectionStatus.textContent = "Posisikan wajah Anda di depan kamera";
        facesDetected.textContent = "0";
        detectionInfo.style.display = 'none';
        return;
    }

    // Ambil wajah pertama (untuk kesederhanaan)
    const expression = expressions[0].expressions;

    // Cari emosi dominan
    // Cari emosi dominan dulu
    let dominant = { emotion: "neutral", value: 0 };

    Object.keys(expression).forEach(emotion => {
        if (expression[emotion] > dominant.value) {
            dominant.emotion = emotion;
            dominant.value = expression[emotion];
        }
    });

    // 🔥 TARUH LOGIKA INI DI LUAR LOOP
    if (dominant.emotion !== lastEmotion) {
        lastEmotion = dominant.emotion;
        emotionStartTime = Date.now();
        stickerGenerated = false;
    } else {
        if (!stickerGenerated && Date.now() - emotionStartTime > 1500) {
            showSticker(dominant.emotion);
            stickerGenerated = true;
        }
    }


    // Perbarui tampilan emosi dominan
    const dominantEmotionName = dominant.emotion.charAt(0).toUpperCase() + dominant.emotion.slice(1);
    dominantEmotion.innerHTML = `<i class="${emotionIcons[dominant.emotion]} me-2"></i>${dominantEmotionName} (${Math.round(dominant.value * 100)}%)`;
    detectionStatus.textContent = `${expressions.length} wajah${expressions.length > 1 ? '' : ''} terdeteksi`;

    // Perbarui info overlay deteksi
    detectionInfo.style.display = 'block';
    faceCount.textContent = expressions.length;

    // Perbarui badge emosi
    emotionBadges.innerHTML = '';
    Object.keys(expression).forEach(emotion => {
        const percent = Math.round(expression[emotion] * 100);
        const emotionName = emotion.charAt(0).toUpperCase() + emotion.slice(1);
        const badge = document.createElement('span');
        badge.className = 'emotion-badge';
        badge.style.backgroundColor = emotionColors[emotion].bg;
        badge.style.color = emotionColors[emotion].text;
        badge.innerHTML = `<i class="${emotionIcons[emotion]} me-1"></i>${emotionName}: ${percent}%`;
        emotionBadges.appendChild(badge);
    });

    // Perbarui bar progres
    Object.keys(expression).forEach(emotion => {
        const percent = Math.round(expression[emotion] * 100);
        const percentElement = document.getElementById(`${emotion}Percent`);
        const progressElement = document.getElementById(`${emotion}Progress`);

        if (percentElement) percentElement.textContent = `${percent}%`;
        if (progressElement) progressElement.style.width = `${percent}%`;
    });

    // Perbarui statistik
    facesDetected.textContent = expressions.length;
}

// Hitung FPS
function calculateFPS() {
    const now = Date.now();
    frameCount++;

    if (now - lastUpdateTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastUpdateTime = now;
        detectionFPS.textContent = fps;
    }
}

// Mulai deteksi wajah
async function startDetection() {
    if (isDetecting || !faceapi) return;

    isDetecting = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    const interval = parseInt(frequencyRange.value);
    detectionInterval = setInterval(async () => {
        try {
            const options = new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: parseFloat(sensitivityRange.value)
            });

            const detections = await faceapi
                .detectAllFaces(video, options)
                .withFaceLandmarks()
                .withFaceExpressions();

            // Set ukuran canvas sesuai video
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;

            // Ubah ukuran deteksi agar sesuai dengan ukuran tampilan video
            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            faceapi.matchDimensions(overlay, displaySize);
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // Hapus overlay
            const ctx = overlay.getContext('2d');
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            // Set transparansi untuk gambar
            ctx.globalAlpha = parseFloat(opacityRange.value);

            // Gambar deteksi dan ekspresi
            faceapi.draw.drawDetections(overlay, resizedDetections);
            faceapi.draw.drawFaceLandmarks(overlay, resizedDetections);
            faceapi.draw.drawFaceExpressions(overlay, resizedDetections);

            // Reset transparansi
            ctx.globalAlpha = 1.0;

            // Perbarui tampilan emosi
            updateEmotionDisplay(resizedDetections);

            // Hitung FPS
            calculateFPS();
        } catch (error) {
            console.error("Error deteksi:", error);
        }
    }, interval);
}

// Hentikan deteksi wajah
function stopDetection() {
    if (!isDetecting) return;

    isDetecting = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }

    // Hapus overlay
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Reset tampilan
    dominantEmotion.textContent = "Deteksi dihentikan";
    detectionStatus.textContent = "Klik 'Mulai Deteksi' untuk memulai";
    facesDetected.textContent = "0";
    detectionFPS.textContent = "0";
    detectionInfo.style.display = 'none';
}

// Tombol toggle kamera
async function toggleCamera() {
    if (isCameraOn) {
        // Matikan kamera
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        video.srcObject = null;
        video.style.display = 'none';
        overlay.style.display = 'none';
        toggleCameraBtn.innerHTML = '<i class="fas fa-video me-2"></i> Hidupkan Kamera';
        toggleCameraBtn.classList.remove('btn-warning');
        toggleCameraBtn.classList.add('btn-success');

        // Hentikan deteksi jika sedang berjalan
        if (isDetecting) {
            stopDetection();
        }

        isCameraOn = false;
    } else {
        // Hidupkan kamera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 720 },
                    height: { ideal: 560 },
                    facingMode: "user"
                }
            });

            videoStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            overlay.style.display = 'block';

            video.play().then(() => {
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;

                toggleCameraBtn.innerHTML = '<i class="fas fa-video-slash me-2"></i> Matikan Kamera';
                toggleCameraBtn.classList.remove('btn-success');
                toggleCameraBtn.classList.add('btn-warning');
                isCameraOn = true;
            });
        } catch (error) {
            console.error("Error mengaktifkan kamera:", error);
            alert("Tidak dapat mengaktifkan kamera: " + error.message);
        }
    }
}

// Screenshot kamera (video + overlay)
function takeCameraScreenshot() {
    if (!isCameraOn) {
        alert("Aktifkan kamera terlebih dahulu!");
        return;
    }

    // Buat canvas sementara untuk menggabungkan video dan overlay
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Gambar frame video
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // Gambar overlay di atasnya
    tempCtx.drawImage(overlay, 0, 0);

    // Tambahkan timestamp
    tempCtx.font = '16px Arial';
    tempCtx.fillStyle = 'white';
    tempCtx.fillText(`Deteksi Emosi - ${new Date().toLocaleString()}`, 10, 30);

    // Buat tautan unduhan
    const link = document.createElement('a');
    link.download = `emotion-camera-${new Date().getTime()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();

    // Tampilkan umpan balik
    const originalText = screenshotCameraBtn.innerHTML;
    screenshotCameraBtn.innerHTML = '<i class="fas fa-check me-2"></i> Screenshot Kamera Tersimpan!';
    screenshotCameraBtn.classList.remove('btn-info');
    screenshotCameraBtn.classList.add('btn-success');

    setTimeout(() => {
        screenshotCameraBtn.innerHTML = originalText;
        screenshotCameraBtn.classList.remove('btn-success');
        screenshotCameraBtn.classList.add('btn-info');
    }, 2000);
}

// Screenshot hasil analisis (presentase)
function takeResultScreenshot() {
    // Ambil elemen hasil analisis
    const resultCard = document.querySelector('.col-lg-4 .card');

    if (!resultCard) {
        alert("Tidak dapat menemukan hasil analisis!");
        return;
    }

    // Tambahkan loading state
    const originalText = screenshotResultBtn.innerHTML;
    screenshotResultBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Memproses...';
    screenshotResultBtn.disabled = true;

    // Gunakan html2canvas untuk screenshot
    html2canvas(resultCard, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        allowTaint: true,
        useCORS: true
    }).then(canvas => {
        // Tambahkan judul dan timestamp
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height + 60; // Tambahkan ruang untuk header
        const tempCtx = tempCanvas.getContext('2d');

        // Background putih
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Tambahkan judul
        tempCtx.fillStyle = '#2E7D32';
        tempCtx.font = 'bold 24px Arial';
        tempCtx.fillText('Laporan Analisis Emosi', 20, 40);

        // Tambahkan timestamp
        tempCtx.fillStyle = '#666666';
        tempCtx.font = '14px Arial';
        tempCtx.fillText(`Tanggal: ${new Date().toLocaleString()}`, 20, 65);

        // Gambar hasil screenshot
        tempCtx.drawImage(canvas, 0, 70);

        // Buat tautan unduhan
        const link = document.createElement('a');
        link.download = `emotion-analysis-${new Date().getTime()}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();

        // Reset button
        screenshotResultBtn.innerHTML = originalText;
        screenshotResultBtn.disabled = false;

        // Tampilkan umpan balik
        screenshotResultBtn.innerHTML = '<i class="fas fa-check me-2"></i> Screenshot Hasil Tersimpan!';
        screenshotResultBtn.classList.remove('btn-primary');
        screenshotResultBtn.classList.add('btn-success');

        setTimeout(() => {
            screenshotResultBtn.innerHTML = originalText;
            screenshotResultBtn.classList.remove('btn-success');
            screenshotResultBtn.classList.add('btn-primary');
        }, 2000);

    }).catch(error => {
        console.error("Error screenshot:", error);
        alert("Gagal mengambil screenshot: " + error.message);

        // Reset button
        screenshotResultBtn.innerHTML = originalText;
        screenshotResultBtn.disabled = false;
        screenshotResultBtn.classList.remove('btn-success');
        screenshotResultBtn.classList.add('btn-primary');
    });
}

// Screenshot gabungan (kamera + hasil)
function takeCombinedScreenshot() {
    if (!isCameraOn) {
        alert("Aktifkan kamera terlebih dahulu!");
        return;
    }

    // Ambil kedua elemen
    const videoContainer = document.querySelector('.video-container');
    const resultCard = document.querySelector('.col-lg-4 .card');

    if (!videoContainer || !resultCard) {
        alert("Tidak dapat menemukan elemen!");
        return;
    }

    // Buat container sementara untuk gabungan
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1200px'; // Lebar total
    container.style.padding = '20px';
    container.style.backgroundColor = '#f8f9fa';
    document.body.appendChild(container);

    // Clone elemen
    const videoClone = videoContainer.cloneNode(true);
    const resultClone = resultCard.cloneNode(true);

    // Atur styling untuk clone
    videoClone.style.width = '700px';
    videoClone.style.marginRight = '20px';
    videoClone.style.float = 'left';

    resultClone.style.width = '480px';
    resultClone.style.float = 'left';
    resultClone.style.margin = '0';

    // Tambahkan ke container
    container.appendChild(videoClone);
    container.appendChild(resultClone);

    // Tambahkan judul
    const title = document.createElement('div');
    title.innerHTML = '<h2 style="color: #2E7D32; text-align: center; margin-bottom: 20px;">Laporan Lengkap Deteksi Emosi</h2>';
    title.innerHTML += `<p style="text-align: center; color: #666; margin-bottom: 30px;">${new Date().toLocaleString()}</p>`;
    container.insertBefore(title, container.firstChild);

    // Ambil screenshot
    html2canvas(container, {
        backgroundColor: '#f8f9fa',
        scale: 1,
        logging: false
    }).then(canvas => {
        // Buat tautan unduhan
        const link = document.createElement('a');
        link.download = `emotion-full-report-${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Hapus container sementara
        document.body.removeChild(container);
    });
}

// Muat Face-API.js secara dinamis
function loadFaceAPI() {
    return new Promise((resolve, reject) => {
        if (window.faceapi) {
            resolve(window.faceapi);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
        script.defer = true;

        script.onload = () => {
            if (window.faceapi) {
                faceapi = window.faceapi;
                resolve(faceapi);
            } else {
                reject(new Error('Face-API.js dimuat tetapi tidak tersedia'));
            }
        };

        script.onerror = () => {
            reject(new Error('Gagal memuat Face-API.js'));
        };

        document.head.appendChild(script);
    });
}

// Muat model face-api
async function loadModels() {
    try {
        console.log("Memuat pustaka Face-API.js...");

        // Muat pustaka
        await loadFaceAPI();
        console.log("Face-API.js berhasil dimuat");

        // Sekarang muat model
        console.log("Memuat model AI...");
        modelStatus.innerHTML = '<i class="fas fa-sync-alt fa-spin me-1"></i> Memuat Model AI...';

        // Tentukan URL model - menggunakan model resmi
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);

        console.log("Semua model berhasil dimuat");
        modelStatus.innerHTML = '<i class="fas fa-check-circle me-1"></i> Model AI Berhasil Dimuat!';
        modelStatus.className = 'model-status loaded';

        return true;
    } catch (error) {
        console.error("Error memuat model:", error);
        modelStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i> Error: ${error.message}`;
        modelStatus.className = 'model-status error';
        return false;
    }
}

// Inisialisasi webcam
async function initWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 720 },
                height: { ideal: 560 },
                facingMode: "user"
            }
        });

        videoStream = stream;
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play().then(() => {
                    // Set ukuran canvas sesuai video
                    overlay.width = video.videoWidth;
                    overlay.height = video.videoHeight;
                    resolve(true);
                });
            };
        });
    } catch (error) {
        console.error("Error mengakses webcam:", error);
        loadingOverlay.innerHTML = `
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                        <p>Error Webcam: ${error.message}</p>
                        <p class="small">Harap periksa izin kamera Anda dan coba lagi.</p>
                        <button class="btn btn-light mt-2" onclick="initWebcam()">Coba Lagi</button>
                    </div>
                `;
        return false;
    }
}

// Fungsi inisialisasi utama
async function initializeApp() {
    // Inisialisasi komponen UI
    initializeProgressBars();

    // Muat model terlebih dahulu
    const modelsLoaded = await loadModels();

    if (!modelsLoaded) {
        loadingOverlay.style.display = 'flex';
        return;
    }

    // Inisialisasi webcam
    loadingOverlay.style.display = 'flex';
    const webcamReady = await initWebcam();

    if (webcamReady) {
        loadingOverlay.style.display = 'none';
        startBtn.disabled = false;
        detectionStatus.textContent = "Siap untuk memulai deteksi";
    }
}

// Pendengar event
startBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopDetection);
toggleCameraBtn.addEventListener('click', toggleCamera);
screenshotCameraBtn.addEventListener('click', takeCameraScreenshot);
screenshotResultBtn.addEventListener('click', takeResultScreenshot);

// Event listener tambahan untuk screenshot gabungan (opsional)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        takeCombinedScreenshot();
    }
});

sensitivityRange.addEventListener('input', function () {
    document.querySelectorAll('#sensitivityRange ~ div small')[1].textContent =
        this.value < 0.4 ? 'Rendah' : this.value < 0.7 ? 'Sedang' : 'Tinggi';
});

frequencyRange.addEventListener('input', function () {
    const value = parseInt(this.value);
    document.querySelectorAll('#frequencyRange ~ div small')[1].textContent =
        value < 150 ? 'Cepat' : value < 300 ? 'Sedang' : 'Lambat';
});

opacityRange.addEventListener('input', function () {
    if (overlay && overlay.getContext) {
        overlay.getContext('2d').globalAlpha = parseFloat(this.value);
    }
});
// Buat Fungsi Tampilkan Sticker
function showSticker(emotion) {
    const stickerPreview = document.getElementById("stickerPreview");
    const stickerPath = emotionStickers[emotion];

    if (!stickerPath) return;

    stickerPreview.src = stickerPath;
}
//Fungsi Download Sticker
const downloadStickerBtn = document.getElementById("downloadStickerBtn");

downloadStickerBtn.addEventListener("click", function () {
    const stickerPreview = document.getElementById("stickerPreview");

    if (!stickerPreview.src) {
        alert("Belum ada sticker yang dihasilkan!");
        return;
    }

    const link = document.createElement("a");
    link.href = stickerPreview.src;
    link.download = "emotion-sticker.png";
    link.click();
});


// Inisialisasi aplikasi saat halaman dimuat
window.addEventListener('DOMContentLoaded', initializeApp);
