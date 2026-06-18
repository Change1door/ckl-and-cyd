/* ============================================================
   图片压缩 helper
   - 用 <canvas> 把图片缩到 长边 1600px (够朋友圈/网页用)
   - JPEG 质量 0.8 (看起来无损, 文件大小减 70%)
   - 输出 Blob (体积比 base64 小)
   - 5MB 原图 → ~400KB 压缩后, 上传从 30s 变 2s
   ============================================================ */

(function () {
  const MAX_DIMENSION = 1600;
  const QUALITY = 0.8;

  async function compressImage(file) {
    // 已是 base64 字符串, 直接返回
    if (typeof file === 'string') return file;
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    // 太小 (< 200KB) 就不压, 节省处理时间
    if (file.size < 200 * 1024) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width >= height) {
              height = Math.round(height * (MAX_DIMENSION / width));
              width = MAX_DIMENSION;
            } else {
              width = Math.round(width * (MAX_DIMENSION / height));
              height = MAX_DIMENSION;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          // 优先 jpeg, png 走 png (透明背景)
          const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl);
              if (!blob) { resolve(file); return; }
              // 压缩后反而更大, 就用原图
              if (blob.size >= file.size) { resolve(file); return; }
              // 把 blob 包装成 file, 保留原 name
              const compressed = new File([blob], file.name, { type: outType, lastModified: Date.now() });
              resolve(compressed);
            },
            outType,
            QUALITY
          );
        } catch (e) {
          URL.revokeObjectURL(objectUrl);
          reject(e);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('图片加载失败')); };
      img.src = objectUrl;
    });
  }

  window.compressImage = compressImage;
})();
