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
                store: true // 存储完整文档
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
            
            const data = await response.json();
            const categories = data.categories;
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
                        console.log('添加文档:', doc); // 调试日志
                    } catch (error) {
                        console.error(`加载文章内容失败: ${article.slug}`, error);
                    }
                }
            }
            
            console.log('搜索索引构建完成，总文档数:', this.documents.size);
        } catch (error) {
            console.error('构建搜索索引失败:', error);
            throw error;
        }
    }

    search(query) {
        if (!query || !query.trim()) return [];
        console.log('执行搜索，查询词:', query); // 调试日志

        // 执行多字段搜索
        const searchResults = [];
        ['title', 'content', 'category', 'tags'].forEach(field => {
            const fieldResults = this.index.search(query, {
                field: field,
                limit: 20,
                suggest: true,
                enrich: true // 确保返回完整的文档
            });
            searchResults.push(...fieldResults);
        });

        console.log('原始搜索结果:', searchResults); // 调试日志

        // 合并搜索结果并去重
        const uniqueResults = new Map();
        
        searchResults.forEach(result => {
            if (!result.result || !Array.isArray(result.result)) return;
            
            result.result.forEach(item => {
                const docId = item.doc.id;
                const doc = this.documents.get(docId);
                
                if (!doc) {
                    console.warn('未找到文档:', docId);
                    return;
                }

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
        const finalResults = Array.from(uniqueResults.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        console.log('最终搜索结果:', finalResults); // 调试日志
        return finalResults;
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