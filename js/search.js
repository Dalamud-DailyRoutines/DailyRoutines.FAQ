class SearchEngine {
    constructor() {
        // 自定义分词器，提高中文搜索效果
        const encoder = str => {
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
                        encode: encoder
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
                store: ["title", "category", "tags", "date", "slug"]
            },
            tokenize: "full",
            optimize: true,
            resolution: 9,
            cache: true
        });
        this.documents = new Map();
    }

    async init() {
        try {
            const response = await fetch(`${CONFIG.basePath}/${CONFIG.indexFile}?v=${CONFIG.cacheVersion}`);
            if (!response.ok) throw new Error('无法加载文章索引');
            
            const categories = await response.json();
            this.documents.clear();
            
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
                        
                        this.documents.set(doc.id, doc);
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
                const docId = item.id;
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
        const results = [];
        for (const doc of this.documents.values()) {
            if (doc.tags && doc.tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
                results.push(doc);
            }
        }
        return results;
    }

    searchByCategory(category) {
        if (!category) return [];
        const results = [];
        for (const doc of this.documents.values()) {
            if (doc.category.toLowerCase() === category.toLowerCase()) {
                results.push(doc);
            }
        }
        return results;
    }
} 