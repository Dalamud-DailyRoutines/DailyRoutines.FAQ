// 配置参数
const CONFIG = {
    articlesPath: 'articles',
    indexFile: 'articles.json',
    basePath: '',
    get cacheVersion() {
        return window.APP_VERSION ? window.APP_VERSION.current : Date.now();
    },
    recentArticlesCount: 5
};

// 初始化基础路径
function initBasePath() {
    const baseUrl = new URL('.', window.location.href).pathname;
    CONFIG.basePath = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

// 自动检测文件更新的函数
async function checkFileLastModified(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const lastModified = response.headers.get('last-modified');
        return lastModified ? new Date(lastModified).getTime() : Date.now();
    } catch (error) {
        console.warn('无法获取文件修改时间:', error);
        return Date.now();
    }
}

// 更新版本时间戳
async function updateVersionTimestamp() {
    try {
        const timestamps = await Promise.all([
            checkFileLastModified(`${CONFIG.basePath}/${CONFIG.indexFile}`),
            checkFileLastModified(`${CONFIG.basePath}/js/app.js`),
            checkFileLastModified(`${CONFIG.basePath}/js/search.js`)
        ]);
        
        // 使用最新的修改时间作为版本号
        window.APP_VERSION.timestamp = Math.max(...timestamps);
    } catch (error) {
        console.warn('更新版本时间戳失败:', error);
        window.APP_VERSION.timestamp = Date.now();
    }
}

class FAQApp {
    constructor() {
        // 确保语言配置存在
        if (!window.LANGUAGE_CONFIG) {
            console.error('语言配置未加载！');
            window.LANGUAGE_CONFIG = {
                default: 'zh',
                supported: ['zh'],
                labels: { 'zh': '中文' }
            };
        }
        
        this.categories = [];
        this.categoryWeights = {}; // 添加分类权重存储
        
        // 获取本地存储的语言设置或浏览器语言
        const savedLanguage = localStorage.getItem('selectedLanguage');
        if (savedLanguage) {
            this.currentLanguage = savedLanguage;
        } else {
            // 获取浏览器语言
            const browserLang = navigator.language.toLowerCase().split('-')[0];
            // 检查浏览器语言是否在支持的语言列表中
            this.currentLanguage = window.LANGUAGE_CONFIG.supported.includes(browserLang)
                ? browserLang
                : window.LANGUAGE_CONFIG.default;
            // 保存初始语言设置
            localStorage.setItem('selectedLanguage', this.currentLanguage);
        }

        this.searchEngine = new SearchEngine();
        this.currentArticle = null;
        this.lastIndexCheck = 0;
        initBasePath();
        this.init();
        this.setupAutoRefresh();
    }

    // 添加翻译辅助函数
    t(key) {
        const keys = key.split('.');
        let value = window.TRANSLATIONS[this.currentLanguage];
        for (const k of keys) {
            if (!value || !value[k]) {
                console.warn(`Translation missing for key: ${key} in language: ${this.currentLanguage}`);
                // 回退到默认语言
                value = window.TRANSLATIONS[window.LANGUAGE_CONFIG.default];
                for (const defaultK of keys) {
                    value = value[defaultK];
                }
                break;
            }
            value = value[k];
        }
        return value;
    }

    setupAutoRefresh() {
        // 每分钟检查一次更新
        setInterval(() => this.checkForUpdates(), 60000);
        // 当页面从隐藏状态变为可见时也检查更新
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkForUpdates();
            }
        });
    }

    async checkForUpdates() {
        try {
            const response = await fetch(`${CONFIG.basePath}/${CONFIG.indexFile}?v=${CONFIG.cacheVersion}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (!response.ok) return;
            
            const newIndex = await response.json();
            const currentHash = JSON.stringify(this.categories);
            const newHash = JSON.stringify(newIndex.categories);
            
            if (currentHash !== newHash) {
                console.log('检测到文章更新，正在刷新...');
                this.categories = newIndex.categories;
                this.categoryWeights = newIndex.categoryWeights || {}; // 更新分类权重
                
                // 根据权重重新排序分类
                this.categories.sort((a, b) => {
                    const weightA = this.categoryWeights[a.name] || 0;
                    const weightB = this.categoryWeights[b.name] || 0;
                    if (weightA === weightB) {
                        return a.name.localeCompare(b.name);
                    }
                    return weightB - weightA;
                });
                
                this.renderCategories();
                // 强制重新加载当前文章（如果有）
                const hash = window.location.hash;
                if (hash) {
                    const [category, slug] = hash.slice(1).split('/');
                    if (category && slug) {
                        this.loadArticle(slug, category);
                    }
                }
            }
        } catch (error) {
            console.error('检查更新失败:', error);
        }
    }

    async init() {
        try {
            await this.loadIndex();
            await this.searchEngine.init();
            this.renderCategories();
            this.setupEventListeners();
            this.checkInitialHash();
            this.setupCategoryState();
            this.setupTheme();
            this.setupNavigation();
            this.setupSearch();
            this.updatePageTitle();
        } catch (error) {
            console.error('初始化失败:', error);
            document.getElementById('category-list').innerHTML = `
                <div class="error-message">
                    <h2>${this.t('errors.loadFailed')}</h2>
                    <p>${this.t('errors.indexLoadError')}</p>
                    <p>${this.t('errors.errorMessage')}: ${error.message}</p>
                </div>
            `;
        }
    }

    async loadIndex() {
        const response = await fetch(`${CONFIG.basePath}/${CONFIG.indexFile}?v=${CONFIG.cacheVersion}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.categories = data.categories;
        this.categoryWeights = data.categoryWeights || {}; // 加载分类权重
        
        // 根据权重重新排序分类
        this.categories.sort((a, b) => {
            const weightA = this.categoryWeights[a.name] || 0;
            const weightB = this.categoryWeights[b.name] || 0;
            if (weightA === weightB) {
                return a.name.localeCompare(b.name);
            }
            return weightB - weightA;
        });

        // 设置语言选择器
        const languageSelector = document.getElementById('language-selector');
        languageSelector.innerHTML = window.LANGUAGE_CONFIG.supported.map(lang => 
            `<option value="${lang}">${window.LANGUAGE_CONFIG.labels[lang]}</option>`
        ).join('');
        languageSelector.value = this.currentLanguage;
        languageSelector.addEventListener('change', (e) => {
            this.currentLanguage = e.target.value;
            localStorage.setItem('selectedLanguage', this.currentLanguage);
            this.updatePageTitle();
            this.renderCategories(); // 重新渲染分类和文章列表
            this.reloadCurrentArticle();
        });
    }

    // 获取文章在当前语言下的标题
    async getArticleTitle(article, category) {
        // 如果文章本身有多语言标题，直接使用
        if (article.titles && article.titles[this.currentLanguage]) {
            return article.titles[this.currentLanguage];
        }

        // 否则尝试从文章文件中获取标题
        try {
            const path = `${CONFIG.basePath}/${CONFIG.articlesPath}/${category}/${article.slug}${this.currentLanguage === window.LANGUAGE_CONFIG.default ? '' : '.' + this.currentLanguage}.md?v=${CONFIG.cacheVersion}`;
            const response = await fetch(path, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (response.ok) {
                const content = await response.text();
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
                if (frontmatterMatch) {
                    const frontmatter = frontmatterMatch[1];
                    const titleMatch = frontmatter.match(/title:\s*(.+)/);
                    if (titleMatch) {
                        return titleMatch[1].trim();
                    }
                }
            }
        } catch (error) {
            console.warn(`无法获取文章 ${article.slug} 的 ${this.currentLanguage} 标题:`, error);
        }

        // 如果获取失败，返回默认标题
        return article.title;
    }

    async renderCategories() {
        const container = document.getElementById('category-list');
        const categoryNav = document.getElementById('category-nav');
        
        // 渲染主页分类卡片
        container.innerHTML = '<div class="loading"><div class="loader"></div><p>' + this.t('loading.index') + '</p></div>';
        categoryNav.innerHTML = ''; // 清空导航

        // 为每个分类异步获取文章标题
        const categoriesHTML = await Promise.all(this.categories.map(async category => {
            const recentArticles = await Promise.all(
                category.articles.slice(0, CONFIG.recentArticlesCount).map(async article => {
                    const title = await this.getArticleTitle(article, category.name);
                    return `
                        <li class="recent-article-item" 
                            data-slug="${article.slug}"
                            data-category="${category.name}">
                            ${title}
                            ${article.date ? `<span class="article-date-small">${article.date}</span>` : ''}
                        </li>
                    `;
                })
            );

            return `
                <div class="category-card" data-category="${category.name}">
                    <div class="category-card-header">
                        <div class="category-icon">${category.name[0]}</div>
                        <h2 class="category-title">${category.name}</h2>
                    </div>
                    <ul class="recent-articles">
                        ${recentArticles.join('')}
                    </ul>
                </div>
            `;
        }));

        container.innerHTML = categoriesHTML.join('');

        // 异步渲染侧边栏导航
        const navHTML = await Promise.all(this.categories.map(async category => {
            const articlesList = await Promise.all(
                category.articles.map(async article => {
                    const title = await this.getArticleTitle(article, category.name);
                    return `
                        <li class="nav-article-item" 
                            data-slug="${article.slug}"
                            data-category="${category.name}">
                            ${title}
                        </li>
                    `;
                })
            );

            return `
                <div class="nav-category">
                    <h4 class="nav-category-title">${category.name}</h4>
                    <ul class="nav-article-list">
                        ${articlesList.join('')}
                    </ul>
                </div>
            `;
        }));

        categoryNav.innerHTML = navHTML.join('');

        // 重新绑定事件监听器
        this.setupEventListeners();
        this.setupCategoryState();
    }

    setupEventListeners() {
        // 主页分类卡片点击事件
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是文章项，不触发分类跳转
                if (!e.target.closest('.recent-article-item')) {
                    const categoryName = card.dataset.category;
                    this.showCategoryPage(categoryName);
                }
            });
        });

        // 主页文章点击事件
        document.querySelectorAll('.recent-article-item').forEach(item => {
            item.addEventListener('click', () => this.loadArticle(
                item.dataset.slug,
                item.dataset.category
            ));
        });

        // 侧边栏文章点击事件
        document.querySelectorAll('.nav-article-item').forEach(item => {
            item.addEventListener('click', () => this.loadArticle(
                item.dataset.slug,
                item.dataset.category
            ));
        });

        // 返回主页按钮点击事件
        document.querySelector('.sidebar-back').addEventListener('click', () => {
            this.showHome();
        });

        // 主页标题点击事件
        document.querySelector('.header-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.showHome();
        });

        // 侧边栏品牌点击事件
        document.querySelector('.sidebar-brand').addEventListener('click', (e) => {
            e.preventDefault();
            this.showHome();
        });

        window.addEventListener('hashchange', () => this.checkInitialHash());
    }

    showHome() {
        document.querySelector('.container').classList.add('hidden');
        document.querySelector('.home-container').classList.remove('hidden');
        window.location.hash = '';
    }

    async loadArticle(slug, category) {
        document.querySelector('.container').classList.remove('hidden');
        document.querySelector('.home-container').classList.add('hidden');
        const articleContent = document.getElementById('article-content');
        articleContent.innerHTML = `
            <div class="loading">
                <div class="loader"></div>
                <p>${this.t('loading.article')}</p>
            </div>
        `;
        
        try {
            // 首先尝试加载当前语言版本
            let path = `${CONFIG.basePath}/${CONFIG.articlesPath}/${category}/${slug}${this.currentLanguage === window.LANGUAGE_CONFIG.default ? '' : '.' + this.currentLanguage}.md?v=${CONFIG.cacheVersion}`;
            let response = await fetch(path, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            // 如果当前语言版本不存在，回退到默认语言版本
            if (!response.ok && this.currentLanguage !== window.LANGUAGE_CONFIG.default) {
                console.log(`当前语言版本 (${this.currentLanguage}) 不存在，使用默认语言版本`);
                path = `${CONFIG.basePath}/${CONFIG.articlesPath}/${category}/${slug}.md?v=${CONFIG.cacheVersion}`;
                response = await fetch(path, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
            }

            if (!response.ok) throw new Error(`文章加载失败 (${response.status})`);
            
            const markdown = await response.text();
            
            // 配置 marked.js 选项
            marked.setOptions({
                gfm: true, // 启用 GitHub 风格的 Markdown
                breaks: true, // 启用换行符转换为 <br>
                headerIds: true, // 为标题添加 id
                mangle: false, // 不转义标题中的特殊字符
                sanitize: false, // 允许 HTML 标签
                smartLists: true, // 使用更智能的列表行为
                smartypants: true, // 使用更智能的标点符号
                xhtml: false, // 不使用 xhtml 模式
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (err) {}
                    }
                    return code;
                }
            });
            
            // 解析 frontmatter
            const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (frontmatterMatch) {
                const [_, frontmatterContent, markdownContent] = frontmatterMatch;
                const frontmatter = {};
                frontmatterContent.split('\n').forEach(line => {
                    const [key, ...values] = line.split(':').map(s => s.trim());
                    if (key && values.length) {
                        if (values[0].startsWith('[')) {
                            frontmatter[key] = values.join(':')
                                .replace(/[\[\]]/g, '')
                                .split(',')
                                .map(tag => tag.trim());
                        } else {
                            frontmatter[key] = values.join(':').trim();
                        }
                    }
                });

                // 构建文章头部 HTML
                let articleHeader = `
                    <div class="article-header">
                        <h1>${frontmatter.title}</h1>
                        ${frontmatter.date ? `
                            <div class="article-date">
                                <svg class="icon" viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M19,4H17V3a1,1,0,0,0-2,0V4H9V3A1,1,0,0,0,7,3V4H5A2,2,0,0,0,3,6V19a2,2,0,0,0,2,2H19a2,2,0,0,0,2-2V6A2,2,0,0,0,19,4Zm0,15H5V8H19Z"/>
                                </svg>
                                ${frontmatter.date}
                            </div>
                        ` : ''}
                        ${frontmatter.tags ? `
                            <div class="article-tags">
                                ${frontmatter.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;

                // 直接渲染 Markdown 内容
                this.renderArticle(articleHeader + marked.parse(markdownContent));
            } else {
                // 如果没有 frontmatter，直接渲染全部内容
                this.renderArticle(marked.parse(markdown));
            }
            
            window.location.hash = `#${category}/${slug}`;

            const savedProgress = localStorage.getItem(`progress:${window.location.hash}`);
            if (savedProgress) {
                requestAnimationFrame(() => {
                    articleContent.scrollTop = savedProgress * 
                        (articleContent.scrollHeight - articleContent.clientHeight);
                });
            }
        } catch (error) {
            console.error('加载文章失败:', error);
            articleContent.innerHTML = `
                <div class="error-message">
                    <h2>加载失败</h2>
                    <p>无法加载文档</p>
                    <p>错误信息: ${error.message}</p>
                </div>
            `;
        }

        // 更新 URL hash
        window.location.hash = `${category}/${slug}`;
        this.currentArticle = { slug, category };
    }

    renderArticle(content) {
        const articleContent = document.getElementById('article-content');
        const articleList = document.getElementById('article-list');
        
        articleContent.innerHTML = content;
        articleList.classList.add('hidden');
        articleContent.classList.remove('hidden');
        
        // 高亮代码块
        document.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });

        // 保存阅读进度
        articleContent.addEventListener('scroll', () => {
            const scrollPercent = articleContent.scrollTop / 
                (articleContent.scrollHeight - articleContent.clientHeight);
            localStorage.setItem(`progress:${window.location.hash}`, scrollPercent);
        });
    }

    checkInitialHash() {
        if (window.location.hash) {
            const [category, slug] = window.location.hash.substring(1).split('/');
            this.loadArticle(slug, category);
        } else {
            this.showHome();
        }
    }

    setupCategoryState() {
        this.categoryState = JSON.parse(localStorage.getItem('categoryState') || '{}');
        
        document.querySelectorAll('.nav-category-title').forEach(title => {
            const category = title.textContent;
            const articlesList = title.nextElementSibling;
            articlesList.hidden = !this.categoryState[category];
            
            title.addEventListener('click', () => {
                articlesList.hidden = !articlesList.hidden;
                this.saveCategoryState(category, !articlesList.hidden);
            });
        });
    }

    saveCategoryState(category, isOpen) {
        this.categoryState[category] = isOpen;
        localStorage.setItem('categoryState', JSON.stringify(this.categoryState));
    }

    setupTheme() {
        this.theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'theme-toggle';
        toggleBtn.innerHTML = this.theme === 'dark' ? '🌞' : '🌙';
        document.body.appendChild(toggleBtn);
        
        toggleBtn.addEventListener('click', () => {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', this.theme);
            toggleBtn.innerHTML = this.theme === 'dark' ? '🌞' : '🌙';
            localStorage.setItem('theme', this.theme);
        });
    }

    setupNavigation() {
        // 添加导航相关的键盘快捷键
        document.addEventListener('keydown', (e) => {
            // ESC 键返回主页
            if (e.key === 'Escape') {
                this.showHome();
            }
            
            // Ctrl/Cmd + K 聚焦搜索框
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('search-input').focus();
            }
        });
    }

    setupSearch() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        let debounceTimer;

        // 搜索输入处理
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            
            // 清空搜索结果
            if (!query) {
                searchResults.innerHTML = '';
                return;
            }

            // 延迟执行搜索
            debounceTimer = setTimeout(() => {
                console.log('执行搜索:', query); // 添加调试日志
                const results = this.searchEngine.search(query);
                console.log('搜索结果:', results); // 添加调试日志
                this.renderSearchResults(results);
            }, 200);
        });

        // 搜索框快捷键
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                searchInput.value = '';
                searchResults.innerHTML = '';
                searchInput.blur();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const firstResult = searchResults.querySelector('.search-result-item');
                if (firstResult) {
                    this.loadArticle(
                        firstResult.dataset.slug,
                        firstResult.dataset.category
                    );
                    searchResults.innerHTML = '';
                    searchInput.value = '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const firstResult = searchResults.querySelector('.search-result-item');
                if (firstResult) {
                    firstResult.focus();
                }
            }
        });

        // 点击搜索结果外部时关闭搜索结果
        document.addEventListener('click', (e) => {
            if (!searchResults.contains(e.target) && !searchInput.contains(e.target)) {
                searchResults.innerHTML = '';
            }
        });

        // 标签点击事件
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag')) {
                e.preventDefault();
                e.stopPropagation();
                const tag = e.target.textContent;
                console.log('点击标签:', tag); // 添加调试日志
                const results = this.searchEngine.searchByTag(tag);
                console.log('标签搜索结果:', results); // 添加调试日志
                searchInput.value = `#${tag}`;
                searchInput.focus();
                this.renderSearchResults(results);
            }
        });

        searchInput.placeholder = this.t('search.placeholder');
    }

    renderSearchResults(results) {
        const container = document.getElementById('search-results');
        if (results.length === 0) {
            container.innerHTML = `<div class="no-results">${this.t('search.noResults')}</div>`;
            return;
        }

        console.log('渲染搜索结果:', results); // 添加调试日志

        const html = results.map(result => `
            <div class="search-result-item" data-slug="${result.slug}" data-category="${result.category}" tabindex="0">
                <div class="search-result-title">${result.title}</div>
                <div class="search-result-meta">
                    <span class="search-result-category">${result.category}</span>
                    ${result.date ? `<span class="search-result-date">${result.date}</span>` : ''}
                </div>
                ${result.tags && result.tags.length > 0 ? `
                    <div class="search-result-tags">
                        ${result.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

        container.innerHTML = html;

        // 为搜索结果添加点击事件
        container.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.loadArticle(
                    item.dataset.slug, 
                    item.dataset.category // 修正参数顺序
                );
                container.innerHTML = '';
                document.getElementById('search-input').value = '';
            });

            // 添加键盘导航
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.loadArticle(item.dataset.slug, item.dataset.category);
                    container.innerHTML = '';
                    document.getElementById('search-input').value = '';
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = item.nextElementSibling;
                    if (next) next.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = item.previousElementSibling;
                    if (prev) {
                        prev.focus();
                    } else {
                        document.getElementById('search-input').focus();
                    }
                }
            });
        });
    }

    reloadCurrentArticle() {
        if (this.currentArticle) {
            this.loadArticle(this.currentArticle.slug, this.currentArticle.category);
        }
    }

    updatePageTitle() {
        document.title = this.t('siteTitle');
        document.querySelector('.site-title').textContent = this.t('siteTitle');
        document.querySelector('.sidebar-title').textContent = this.t('siteTitle');
    }

    async showCategoryPage(categoryName) {
        document.querySelector('.container').classList.remove('hidden');
        document.querySelector('.home-container').classList.add('hidden');
        const articleContent = document.getElementById('article-content');
        const articleList = document.getElementById('article-list');
        
        articleContent.classList.add('hidden');
        articleList.classList.remove('hidden');
        
        // 查找对应的分类
        const category = this.categories.find(cat => cat.name === categoryName);
        if (!category) return;
        
        // 渲染分类页面
        articleList.innerHTML = `
            <h1 class="category-page-title">${categoryName}</h1>
            <div class="article-list">
                ${await Promise.all(category.articles.map(async article => {
                    const title = await this.getArticleTitle(article, categoryName);
                    return `
                        <div class="article-item" data-slug="${article.slug}" data-category="${categoryName}">
                            <h3 class="article-title">${title}</h3>
                            ${article.date ? `<div class="article-date">${article.date}</div>` : ''}
                            ${article.tags && article.tags.length ? `
                                <div class="article-tags">
                                    ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                })).then(articles => articles.join(''))}
            </div>
        `;
        
        // 添加文章点击事件
        articleList.querySelectorAll('.article-item').forEach(item => {
            item.addEventListener('click', () => {
                this.loadArticle(item.dataset.slug, item.dataset.category);
            });
        });
        
        // 更新URL
        window.location.hash = `#${categoryName}`;
    }
}

// 创建加载状态指示器
function createLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'loading-indicator';
    indicator.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载文档 (0%)</div>
        <div class="loading-progress">
            <div class="progress-bar"></div>
        </div>
    `;
    return indicator;
}

// 更新加载进度
function updateLoadingProgress(progress) {
    const indicator = document.querySelector('.loading-indicator');
    if (!indicator) return;

    const progressBar = indicator.querySelector('.progress-bar');
    const loadingText = indicator.querySelector('.loading-text');
    
    progressBar.style.width = `${progress.percentage}%`;
    loadingText.textContent = `正在加载文档 (${progress.percentage}%)`;
    
    if (progress.percentage >= 100) {
        setTimeout(() => {
            indicator.classList.add('fade-out');
            setTimeout(() => indicator.remove(), 500);
        }, 500);
    }
}

// 初始化应用
async function initializeApp() {
    const loadingIndicator = createLoadingIndicator();
    document.body.appendChild(loadingIndicator);

    // 初始化搜索引擎
    window.searchEngine = new SearchEngine();
    searchEngine.onProgress(updateLoadingProgress);

    try {
        await searchEngine.init();
        setupEventListeners();
        loadInitialContent();
    } catch (error) {
        console.error('初始化失败:', error);
        loadingIndicator.innerHTML = `
            <div class="loading-error">
                加载失败，请刷新页面重试<br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// 添加样式
const style = document.createElement('style');
style.textContent = `
    .loading-indicator {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        text-align: center;
        z-index: 1000;
        transition: opacity 0.5s;
    }

    .loading-indicator.fade-out {
        opacity: 0;
    }

    .loading-spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
        margin: 0 auto 10px;
    }

    .loading-text {
        margin-bottom: 10px;
        color: #666;
    }

    .loading-progress {
        width: 200px;
        height: 4px;
        background: #f3f3f3;
        border-radius: 2px;
        overflow: hidden;
    }

    .progress-bar {
        width: 0;
        height: 100%;
        background: #3498db;
        transition: width 0.3s ease;
    }

    .loading-error {
        color: #e74c3c;
        max-width: 300px;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// 防止缓存的资源加载函数
function loadResource(url, type = 'text/javascript') {
    return new Promise((resolve, reject) => {
        const resource = type.includes('javascript') ? document.createElement('script') : document.createElement('link');
        
        if (type.includes('javascript')) {
            resource.type = type;
            resource.src = `${url}?_=${Date.now()}`;
        } else {
            resource.rel = 'stylesheet';
            resource.href = `${url}?_=${Date.now()}`;
        }

        resource.onload = () => resolve(resource);
        resource.onerror = () => reject(new Error(`Failed to load ${url}`));
        
        document.head.appendChild(resource);
    });
}

// 初始化应用
document.addEventListener('DOMContentLoaded', initializeApp); 