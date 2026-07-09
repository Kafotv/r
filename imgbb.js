// ============================================
// Pro Store - imgbb Image Upload Helper
// ============================================

const ImgBB = {
  /**
   * Upload an image file to imgbb
   * @param {File|Blob|string} source - File object, Blob, or base64 string
   * @returns {Promise<string>} - URL of the uploaded image
   */
  async upload(source) {
    const formData = new FormData();
    formData.append('key', CONFIG.IMGBB_API_KEY);

    if (source instanceof File || source instanceof Blob) {
      formData.append('image', source);
    } else if (typeof source === 'string') {
      // base64 string
      const base64 = source.replace(/^data:[^;]+;base64,/, '');
      formData.append('image', base64);
    } else {
      throw new Error('Invalid source type for upload');
    }

    try {
      const res = await fetch(CONFIG.IMGBB_UPLOAD_URL, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        return data.data.url;
      }
      throw new Error(data.error?.message || 'Upload failed');
    } catch (e) {
      console.error('ImgBB upload error:', e);
      throw e;
    }
  },

  /**
   * Upload a file and return both url and display_url
   * @param {File|Blob|string} source
   * @returns {Promise<{url: string, display_url: string}>}
   */
  async uploadWithDetails(source) {
    const formData = new FormData();
    formData.append('key', CONFIG.IMGBB_API_KEY);

    if (source instanceof File || source instanceof Blob) {
      formData.append('image', source);
    } else if (typeof source === 'string') {
      const base64 = source.replace(/^data:[^;]+;base64,/, '');
      formData.append('image', base64);
    }

    const res = await fetch(CONFIG.IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      return {
        url: data.data.url,
        display_url: data.data.display_url || data.data.url,
        delete_url: data.data.delete_url || ''
      };
    }
    throw new Error(data.error?.message || 'Upload failed');
  },

  /**
   * Upload multiple files
   * @param {FileList|File[]} files
   * @param {function} onProgress - callback(index, total)
   * @returns {Promise<string[]>} - array of URLs
   */
  async uploadMultiple(files, onProgress) {
    const urls = [];
    for (let i = 0; i < files.length; i++) {
      const url = await this.upload(files[i]);
      urls.push(url);
      if (onProgress) onProgress(i + 1, files.length);
    }
    return urls;
  }
};
