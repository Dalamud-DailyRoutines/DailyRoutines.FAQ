const CACHE_NAME = 'dr-faq-cache-v1';
const STATIC_CACHE = 'static-cache-v1';
const DYNAMIC_CACHE = 'dynamic-cache-v1';

// 需要预缓存的静态资源
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/js/app.js',
    '/js/search.js',
    '/js/config.js',
    '/js/translations.js',
    '/css/style.css',
    '/articles.json',
    'https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.2/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/highlight.min.js',
    'https://cdn.jsdelivr.net/npm/flexsearch@0.7.31/dist/flexsearch.bundle.js'
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('缓存静态资源');
                return cache.addAll(STATIC_ASSETS);
            })
    );
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
                        console.log('删除旧缓存:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

// 处理请求
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // 处理静态资源
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    return response || fetch(request).then(fetchResponse => {
                        return caches.open(STATIC_CACHE)
                            .then(cache => {
                                cache.put(request, fetchResponse.clone());
                                return fetchResponse;
                            });
                    });
                })
        );
        return;
    }

    // 处理文章请求
    if (url.pathname.startsWith('/articles/')) {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    return fetch(request)
                        .then(fetchResponse => {
                            return caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(request, fetchResponse.clone());
                                    return fetchResponse;
                                });
                        })
                        .catch(() => response);
                })
        );
        return;
    }

    // 网络优先策略
    event.respondWith(
        fetch(request)
            .then(response => {
                return caches.open(DYNAMIC_CACHE)
                    .then(cache => {
                        cache.put(request, response.clone());
                        return response;
                    });
            })
            .catch(() => {
                return caches.match(request);
            })
    );
}); 