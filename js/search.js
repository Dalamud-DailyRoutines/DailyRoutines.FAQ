class SearchEngine {
    constructor() {
        this.index = new FlexSearch.Document({
            document: {
                id: "id",
                index: ["title", "content", "category", "tags"],
                store: ["title", "category", "tags", "date", "slug"]
            },
            tokenize: "forward",
            resolution: 9,
            optimize: true,
            cache: true
        });
        this.documents = [];
    }

    async init() {
        try {
            const response = await fetch(`${CONFIG.basePath}/${CONFIG.indexFile}?v=${CONFIG.cacheVersion}`);
            if (!response.ok) throw new Error('无法加载文章索引');
            
            const categories = await response.json();
            this.documents = [];
            
            for (const category of categories) {
                for (const article of category.articles) {
                    try {
                        // 加载文章内容
                        const contentResponse = await fetch(`${CONFIG.basePath}/${CONFIG.articlesPath}/${category.name}/${article.slug}.md?v=${CONFIG.cacheVersion}`);
                        const content = await contentResponse.text();
                        
                        // 将文章信息添加到文档集合
                        const doc = {
                            id: `${category.name}/${article.slug}`,
                            title: article.title,
                            category: category.name,
                            tags: article.tags || [],
                            date: article.date,
                            slug: article.slug,
                            content: content.replace(/^---[\s\S]*?---/, '').replace(/#+/g, '').trim() // 移除frontmatter和标题标记
                        };
                        
                        this.documents.push(doc);
                        this.index.add(doc);
                    } catch (error) {
                        console.error(`加载文章内容失败: ${article.slug}`, error);
                    }
                }
            }
            
            console.log('搜索索引构建完成');
        } catch (error) {
            console.error('构建搜索索引失败:', error);
            throw error;
        }
    }

    search(query) {
        if (!query || !query.trim()) return [];

        // 执行多字段搜索
        const results = [];
        ['title', 'content', 'category', 'tags'].forEach(field => {
            const fieldResults = this.index.search(query, {
                field: field,
                limit: 20,
                suggest: true
            });
            results.push(...fieldResults);
        });

        // 合并搜索结果并去重
        const uniqueResults = new Map();
        
        results.forEach(result => {
            result.result.forEach(item => {
                if (!uniqueResults.has(item.id)) {
                    uniqueResults.set(item.id, {
                        ...item,
                        score: result.field === 'title' ? 2 : 1
                    });
                } else {
                    const existing = uniqueResults.get(item.id);
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
        return this.documents.filter(doc => 
            doc.tags && doc.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        );
    }

    searchByCategory(category) {
        if (!category) return [];
        return this.documents.filter(doc => 
            doc.category.toLowerCase() === category.toLowerCase()
        );
    }
} 