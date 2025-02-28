class SearchEngine {
    constructor() {
        this.index = null;
        this.documents = [];
    }

    async init() {
        await this.buildIndex();
    }

    async buildIndex() {
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
                        this.documents.push({
                            id: `${category.name}/${article.slug}`,
                            title: article.title,
                            category: category.name,
                            tags: article.tags || [],
                            date: article.date,
                            slug: article.slug,
                            content: content.replace(/^---[\s\S]*?---/, '').replace(/#+/g, '').trim() // 移除frontmatter和标题标记
                        });
                    } catch (error) {
                        console.error(`加载文章内容失败: ${article.slug}`, error);
                    }
                }
            }

            // 创建 FlexSearch 索引
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
            
            // 添加文档到索引
            this.documents.forEach(doc => this.index.add(doc));
            
            console.log('搜索索引构建完成');
        } catch (error) {
            console.error('构建搜索索引失败:', error);
            throw error;
        }
    }

    search(query) {
        if (!query.trim()) return [];
        if (!this.index) return [];

        // 执行多字段搜索
        const results = this.index.search(query, {
            enrich: true,
            suggest: true,
            limit: 20
        });

        // 合并搜索结果并去重
        const uniqueResults = new Map();
        
        results.forEach(({ field, result }) => {
            result.forEach(item => {
                if (!uniqueResults.has(item.id)) {
                    uniqueResults.set(item.id, {
                        ...item,
                        score: field === 'title' ? 2 : 1, // 标题匹配得分加倍
                        matchedField: field
                    });
                } else {
                    // 如果已存在，增加匹配分数
                    const existing = uniqueResults.get(item.id);
                    existing.score += field === 'title' ? 2 : 1;
                }
            });
        });

        // 转换为数组并排序
        return Array.from(uniqueResults.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // 限制返回前10个结果
    }

    // 按标签搜索
    searchByTag(tag) {
        if (!tag) return [];
        return this.documents.filter(doc => 
            doc.tags && doc.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        );
    }

    // 按分类搜索
    searchByCategory(category) {
        if (!category) return [];
        return this.documents.filter(doc => 
            doc.category.toLowerCase() === category.toLowerCase()
        );
    }
} 