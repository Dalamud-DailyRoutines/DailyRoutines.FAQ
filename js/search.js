class SearchEngine {
    constructor() {
        // 自定义分词器，提高中文搜索效果
        const encoder = str => {
            if (!str) return [];
            // 将字符串转换为小写并移除特殊字符
            str = str.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ');
            // 对中文进行字符级分词
            return str.split('').filter(char => char.trim());
        };

        this.index = new FlexSearch.Document({
            document: {
                id: "id",
                index: [
                    {
                        field: "title",
                        tokenize: "full",
                        encode: encoder
                    },
                    {
                        field: "content",
                        tokenize: "full",
                        encode: encoder,
                        store: false, // 不存储内容，只索引
                        weight: 0.3   // 降低内容匹配的权重
                    },
                    {
                        field: "category",
                        tokenize: "full",
                        encode: encoder
                    },
                    {
                        field: "tags",
                        tokenize: "full",
                        encode: encoder
                    }
                ],
                store: ["id", "title", "category", "tags", "date", "slug"] // 只存储必要字段
            },
            tokenize: "full",
            optimize: true,
            resolution: 9,
            cache: true
        });
        this.documents = new Map();
        this.loadingPromises = new Map();
        this.loadingStatus = {
            total: 0,
            loaded: 0,
            errors: 0
        };
        
        // 添加加载状态事件
        this.onProgressCallbacks = new Set();
    }

    // 注册进度回调
    onProgress(callback) {
        this.onProgressCallbacks.add(callback);
        return () => this.onProgressCallbacks.delete(callback);
    }

    // 更新加载状态
    updateLoadingStatus(loaded = 0, errors = 0) {
        this.loadingStatus.loaded += loaded;
        this.loadingStatus.errors += errors;
        const progress = {
            ...this.loadingStatus,
            percentage: Math.round((this.loadingStatus.loaded / this.loadingStatus.total) * 100)
        };
        this.onProgressCallbacks.forEach(callback => callback(progress));
    }

    async init() {
        try {
            // 获取最新的索引文件
            const indexResponse = await fetch(`${CONFIG.basePath}/${CONFIG.indexFile}?_v=${CONFIG.cacheVersion}`, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (!indexResponse.ok) throw new Error('无法加载文章索引');
            
            const data = await indexResponse.json();
            const categories = data.categories;
            this.documents.clear();
            
            // 计算总文章数
            this.loadingStatus = {
                total: categories.reduce((sum, cat) => sum + cat.articles.length, 0),
                loaded: 0,
                errors: 0
            };
            
            // 按分类批量加载文章
            const loadPromises = categories.map(category => this.loadCategoryArticles(category));
            await Promise.all(loadPromises);
            
            console.log('搜索索引构建完成，总文档数:', this.documents.size);
        } catch (error) {
            console.error('构建搜索索引失败:', error);
            throw error;
        }
    }

    async loadCategoryArticles(category) {
        const batchSize = 10;
        const articles = category.articles;
        
        for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            const batchPromises = batch.map(article => this.loadArticle(category.name, article));
            const results = await Promise.allSettled(batchPromises);
            
            // 统计本批次的加载结果
            const loaded = results.filter(r => r.status === 'fulfilled').length;
            const errors = results.filter(r => r.status === 'rejected').length;
            this.updateLoadingStatus(loaded, errors);
        }
    }

    async loadArticle(categoryName, article) {
        const articleId = `${categoryName}/${article.slug}`;
        
        if (this.loadingPromises.has(articleId)) {
            return this.loadingPromises.get(articleId);
        }

        const loadPromise = (async () => {
            try {
                // 使用动态版本号加载文章
                const contentResponse = await fetch(
                    `${CONFIG.basePath}/${CONFIG.articlesPath}/${categoryName}/${article.slug}.md?_v=${CONFIG.cacheVersion}`,
                    {
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        }
                    }
                );
                if (!contentResponse.ok) throw new Error(`HTTP ${contentResponse.status}`);
                
                const content = await contentResponse.text();
                const processedContent = content
                    .replace(/^---[\s\S]*?---/, '')
                    .replace(/#+\s[^\n]+/g, '')
                    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
                    .trim();

                const doc = {
                    id: articleId,
                    title: article.title,
                    category: categoryName,
                    tags: article.tags || [],
                    date: article.date,
                    slug: article.slug,
                    content: processedContent
                };

                this.documents.set(doc.id, doc);
                this.index.add(doc);
                return doc;
            } catch (error) {
                console.error(`加载文章失败: ${articleId}`, error);
                throw error;
            } finally {
                this.loadingPromises.delete(articleId);
            }
        })();

        this.loadingPromises.set(articleId, loadPromise);
        return loadPromise;
    }

    search(query) {
        if (!query || !query.trim()) return [];

        // 执行多字段搜索
        const searchResults = [];
        ['title', 'category', 'tags'].forEach(field => {
            const fieldResults = this.index.search(query, {
                field: field,
                limit: 20,
                suggest: true,
                enrich: true
            });
            searchResults.push(...fieldResults);
        });

        // 合并搜索结果并去重
        const uniqueResults = new Map();
        
        searchResults.forEach(result => {
            if (!result.result || !Array.isArray(result.result)) return;
            
            result.result.forEach(item => {
                const docId = item.doc.id;
                const doc = this.documents.get(docId);
                
                if (!doc) return;

                if (!uniqueResults.has(docId)) {
                    uniqueResults.set(docId, {
                        ...doc,
                        score: result.field === 'title' ? 2 : 1
                    });
                } else {
                    const existing = uniqueResults.get(docId);
                    existing.score += result.field === 'title' ? 2 : 1;
                }
            });
        });

        // 转换为数组并排序
        return Array.from(uniqueResults.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    searchByTag(tag) {
        if (!tag) return [];
        console.log('按标签搜索:', tag); // 调试日志
        const results = Array.from(this.documents.values())
            .filter(doc => doc.tags && doc.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
        console.log('标签搜索结果:', results); // 调试日志
        return results;
    }

    searchByCategory(category) {
        if (!category) return [];
        console.log('按分类搜索:', category); // 调试日志
        const results = Array.from(this.documents.values())
            .filter(doc => doc.category.toLowerCase() === category.toLowerCase());
        console.log('分类搜索结果:', results); // 调试日志
        return results;
    }
} 