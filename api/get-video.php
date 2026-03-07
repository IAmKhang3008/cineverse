<?php
// api/get-video.php - Lấy direct video URL

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$slug = $_GET['slug'] ?? '';
$ep = $_GET['ep'] ?? '1';

if (!$slug) {
    die(json_encode(['error' => 'Missing slug']));
}

// Cache trong 1 giờ để giảm tải
$cacheFile = __DIR__ . "/cache/{$slug}_{$ep}.json";
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 3600)) {
    echo file_get_contents($cacheFile);
    exit;
}

// Tạo thư mục cache nếu chưa có
if (!is_dir(__DIR__ . '/cache')) {
    mkdir(__DIR__ . '/cache', 0777, true);
}

// Lấy thông tin phim
$movieApi = "https://phimapi.com/phim/{$slug}";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $movieApi);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

$movieData = curl_exec($ch);
curl_close($ch);

$data = json_decode($movieData, true);

if (!$data || !isset($data['episodes'][0]['server_data'])) {
    die(json_encode(['error' => 'Cannot get movie data']));
}

// Lấy link embed cho tập cần xem
$episodes = $data['episodes'][0]['server_data'];
$episodeIndex = (int)$ep - 1;

if (!isset($episodes[$episodeIndex])) {
    die(json_encode(['error' => 'Episode not found']));
}

$embedUrl = $episodes[$episodeIndex]['link_embed'];

// Lấy nội dung từ embed URL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $embedUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

$embedContent = curl_exec($ch);
curl_close($ch);

// Tìm direct video URL
$videoUrl = null;

// Pattern 1: file: "url"
if (preg_match('/file:\s*["\']([^"\']+\.(mp4|m3u8))["\']/i', $embedContent, $matches)) {
    $videoUrl = $matches[1];
}
// Pattern 2: src: "url"
else if (preg_match('/src:\s*["\']([^"\']+\.(mp4|m3u8))["\']/i', $embedContent, $matches)) {
    $videoUrl = $matches[1];
}
// Pattern 3: source src="url"
else if (preg_match('/<source[^>]+src=["\']([^"\']+\.(mp4|m3u8))["\']/i', $embedContent, $matches)) {
    $videoUrl = $matches[1];
}

if (!$videoUrl) {
    die(json_encode(['error' => 'Cannot extract video URL']));
}

$result = [
    'success' => true,
    'url' => $videoUrl,
    'type' => strpos($videoUrl, '.m3u8') !== false ? 'hls' : 'mp4',
    'episode' => $episodes[$episodeIndex]
];

// Lưu cache
file_put_contents($cacheFile, json_encode($result));

echo json_encode($result);
?>
