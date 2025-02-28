// 配置参数
const CONFIG = {
    articlesPath: 'articles',
    indexFile: 'articles.json',
    basePath: ''
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
        initBasePath();
        this.init();
    }

    async init() {
        try {
            await this.loadIndex();
            this.renderCategories();
            this.setupEventListeners();
            this.checkInitialHash();
            this.setupCategoryState();
            this.setupTheme();
            this.setupNavigation();
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
        const response = await fetch(`${CONFIG.basePath}/${CONFIG.indexFile}`);
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
                    ${category.articles.slice(0, 3).map(article => `
                        <li class="recent-article-item" 
                            data-slug="${article.slug}"
                            data-category="${category.name}">
                            ${article.title}
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
            const path = `${CONFIG.basePath}/${CONFIG.articlesPath}/${category}/${slug}.md`;
            console.log('尝试加载文章:', path); // 调试日志
            const response = await fetch(path);
            if (!response.ok) throw new Error(`文章加载失败 (${response.status})`);
            
            const markdown = await response.text();
            this.renderArticle(marked.parse(markdown));
            window.location.hash = `#${category}/${slug}`;

            const savedProgress = localStorage.getItem(`progress:${window.location.hash}`);
            if (savedProgress) {
                requestAnimationFrame(() => {
                    articleContent.scrollTop = savedProgress * 
                        (articleContent.scrollHeight - articleContent.clientHeight);
                });
            }
        } catch (error) {
            console.error('加载文章失败:', error); // 调试日志
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
}

// 初始化应用
new FAQApp(); 