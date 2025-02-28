// 配置参数
const CONFIG = {
    articlesPath: './articles',
    indexFile: './articles.json'
};

class FAQApp {
    constructor() {
        this.categories = [];
        this.init();
    }

    async init() {
        await this.loadIndex();
        this.renderCategories();
        this.setupEventListeners();
        this.checkInitialHash();
        this.setupCategoryState();
        this.setupTheme();
    }

    async loadIndex() {
        const response = await fetch(CONFIG.indexFile);
        this.categories = await response.json();
    }

    renderCategories() {
        const container = document.getElementById('category-list');
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
    }

    setupEventListeners() {
        document.querySelectorAll('.recent-article-item').forEach(item => {
            item.addEventListener('click', () => this.loadArticle(
                item.dataset.slug,
                item.dataset.category
            ));
        });

        document.querySelectorAll('.category-title').forEach(title => {
            title.addEventListener('click', () => {
                const articlesDiv = title.nextElementSibling;
                articlesDiv.hidden = !articlesDiv.hidden;
                this.saveCategoryState(title.textContent, !articlesDiv.hidden);
            });
        });

        window.addEventListener('hashchange', () => this.checkInitialHash());
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
        
        const path = `${CONFIG.articlesPath}/${category}/${slug}.md`;
        const response = await fetch(path);
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
        }
    }

    setupCategoryState() {
        this.categoryState = JSON.parse(localStorage.getItem('categoryState') || '{}');
        
        document.querySelectorAll('.category-title').forEach(title => {
            const category = title.textContent;
            const articlesDiv = title.nextElementSibling;
            articlesDiv.hidden = !this.categoryState[category];
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
}

// 初始化应用
new FAQApp(); 

// 添加对应的CSS样式
.loading {
    text-align: center;
    padding: 3rem;
    color: var(--primary-color);
}

.loader {
    width: 40px;
    height: 40px;
    margin: 0 auto 1rem;
    border: 3px solid var(--background-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
} 