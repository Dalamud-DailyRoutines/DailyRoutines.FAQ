// 配置参数
const CONFIG = {
    articlesPath: 'articles',
    indexFile: 'articles.json',
    basePath: '',
    cacheVersion: Date.now(), // 添加缓存版本
    recentArticlesCount: 5 // 每个分类显示的最新文章数量
};

// 初始化基础路径
function initBasePath() {
    const scriptPath = document.currentScript.src;
    const baseUrl = new URL('.', window.location.href).pathname;
    CONFIG.basePath = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

class FAQApp {
    constructor() {
        this.categories = [];
        this.searchEngine = new SearchEngine();
        this.currentArticle = null;
        this.lastIndexCheck = 0;
        initBasePath();
        this.init();
        this.setupAutoRefresh();
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
            const newHash = JSON.stringify(newIndex);
            
            if (currentHash !== newHash) {
                console.log('检测到文章更新，正在刷新...');
                this.categories = newIndex;
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
        } catch (error) {
            console.error('初始化失败:', error);
            document.getElementById('category-list').innerHTML = `
                <div class="error-message">
                    <h2>加载失败</h2>
                    <p>无法加载文档索引</p>
                    <p>错误信息: ${error.message}</p>
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
        this.categories = await response.json();
    }

    renderCategories() {
        const container = document.getElementById('category-list');
        const categoryNav = document.getElementById('category-nav');
        
        // 渲染主页分类卡片
        container.innerHTML = this.categories.map(category => `
            <div class="category-card">
                <div class="category-card-header">
                    <div class="category-icon">${category.name[0]}</div>
                    <h2 class="category-title">${category.name}</h2>
                </div>
                <ul class="recent-articles">
                    ${category.articles.slice(0, CONFIG.recentArticlesCount).map(article => `
                        <li class="recent-article-item" 
                            data-slug="${article.slug}"
                            data-category="${category.name}">
                            ${article.title}
                            ${article.date ? `<span class="article-date-small">${article.date}</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('');

        // 渲染侧边栏导航
        categoryNav.innerHTML = this.categories.map(category => `
            <div class="nav-category">
                <h4 class="nav-category-title">${category.name}</h4>
                <ul class="nav-article-list">
                    ${category.articles.map(article => `
                        <li class="nav-article-item" 
                            data-slug="${article.slug}"
                            data-category="${category.name}">
                            ${article.title}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('');
    }

    setupEventListeners() {
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
                <p>正在加载文档...</p>
            </div>
        `;
        
        try {
            const path = `${CONFIG.basePath}/${CONFIG.articlesPath}/${category}/${slug}.md?v=${CONFIG.cacheVersion}`;
            console.log('尝试加载文章:', path);
            const response = await fetch(path, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
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
                    <p>${error.message}</p>
                    <p>路径: ${path}</p>
                    <p>基础路径: ${CONFIG.basePath}</p>
                </div>
            `;
        }
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
                const results = this.searchEngine.search(query);
                this.renderSearchResults(results);
            }, 300);
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
                const results = this.searchEngine.searchByTag(tag);
                searchInput.value = `#${tag}`;
                searchInput.focus();
                this.renderSearchResults(results);
            }
        });
    }

    renderSearchResults(results) {
        const searchResults = document.getElementById('search-results');
        
        if (!results || results.length === 0) {
            searchResults.innerHTML = '<div class="no-results">未找到相关文档</div>';
            return;
        }

        const html = results.map(result => `
            <div class="search-result-item" data-slug="${result.slug}" data-category="${result.category}">
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

        searchResults.innerHTML = html;

        // 为搜索结果添加点击事件
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.loadArticle(item.dataset.slug, item.dataset.category);
                searchResults.innerHTML = '';
                document.getElementById('search-input').value = '';
            });
        });
    }
}

// 初始化应用
new FAQApp(); 