export function downloadZipFiles(urls) {
    urls[0].then(result => {
        if (result) {
            window.location = result;
        }
        if (urls.length > 1) {
            setTimeout(() => downloadZipFiles(urls.slice(1)), 2000);
        }
    });
    return true;
};
