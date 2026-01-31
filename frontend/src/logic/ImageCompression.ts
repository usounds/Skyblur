
export const compressImage = async (file: File, maxSizeInfo: number = 900 * 1024): Promise<File> => {
    if (file.size <= maxSizeInfo) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Maintain aspect ratio, but we can also limit max dimension if we wanted to.
            // For now, just keeping original dimensions and relying on quality reduction.

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Start with quality 0.8
            let quality = 0.8;

            const tryCompression = (q: number) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Canvas to Blob failed'));
                        return;
                    }

                    if (blob.size <= maxSizeInfo || q <= 0.1) {
                        const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                            type: "image/jpeg",
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    } else {
                        // Try lower quality
                        tryCompression(q - 0.1);
                    }
                }, 'image/jpeg', q);
            };

            tryCompression(quality);
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
};
