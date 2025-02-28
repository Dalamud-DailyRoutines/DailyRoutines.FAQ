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
            <div class="category">
                <h2 class="category-title">${category.name}</h2>
                <div class="articles" data-category="${category.name}" hidden>
                    ${category.articles.map(article => `
                        <div class="article-item" data-slug="${article.slug}">
                            ${article.title}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        document.querySelectorAll('.category-title').forEach(title => {
            title.addEventListener('click', () => {
                const articlesDiv = title.nextElementSibling;
                articlesDiv.hidden = !articlesDiv.hidden;
                this.saveCategoryState(title.textContent, !articlesDiv.hidden);
            });
        });

        document.querySelectorAll('.article-item').forEach(item => {
            item.addEventListener('click', () => this.loadArticle(
                item.dataset.slug,
                item.closest('.articles').dataset.category
            ));
        });

        window.addEventListener('hashchange', () => this.checkInitialHash());
    }

    async loadArticle(slug, category) {
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